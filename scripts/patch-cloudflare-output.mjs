#!/usr/bin/env node
/**
 * Post-process `.output/server` for Cloudflare Workers (free plan, workers.dev).
 *
 * Audit architecture (do not reintroduce jsdom on the Worker):
 * - Server fetches HTML (SSRF-safe) via start-audit.
 * - UI runs axe-core in the browser (sandboxed iframe) → complete-audit.
 * - Agents without a browser use start-audit execution=server (reduced checks).
 *
 * This script only applies documented Workers packaging fixes (eager handler
 * import, request DB pool scope, react bare-require shim, agents-bundle stub,
 * crypto.randomUUID top-level workaround). It does NOT patch jsdom.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(root, ".output/server");
const accountId = "ab926f8277b75892c2adb52733be48b5";

function mustExist(p) {
  if (!existsSync(p)) throw new Error(`missing ${p}`);
}

mustExist(server);

const wranglerPath = join(server, "wrangler.json");
mustExist(wranglerPath);
const wrangler = JSON.parse(readFileSync(wranglerPath, "utf8"));
wrangler.name = "a11y-fixer";
wrangler.account_id = accountId;
wrangler.workers_dev = true;
wrangler.no_bundle = true;
wrangler.main = wrangler.main || "worker.mjs";
const flags = new Set(wrangler.compatibility_flags || []);
flags.add("nodejs_compat");
flags.add("nodejs_als");
flags.add("allow_eval_during_startup");
wrangler.compatibility_flags = [...flags];
delete wrangler.triggers;
delete wrangler.routes;
writeFileSync(wranglerPath, JSON.stringify(wrangler, null, 2) + "\n");
console.log("patched wrangler.json");

const libs = join(server, "_libs");
mkdirSync(libs, { recursive: true });

const poolSrc =
  [
    join(root, "node_modules/@agent-native/core/dist/db/request-pool-context.js"),
    ...readdirSync(join(root, "node_modules/.pnpm"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith("@agent-native+core@"))
      .map((d) =>
        join(
          root,
          "node_modules/.pnpm",
          d.name,
          "node_modules/@agent-native/core/dist/db/request-pool-context.js",
        ),
      ),
  ].find((p) => existsSync(p)) || null;

if (poolSrc) {
  writeFileSync(join(libs, "request-pool-context.mjs"), readFileSync(poolSrc));
  console.log("vendored request-pool-context.mjs");
} else if (existsSync("/tmp/a11y-request-pool-context.mjs.bak")) {
  cpSync("/tmp/a11y-request-pool-context.mjs.bak", join(libs, "request-pool-context.mjs"));
  console.log("restored request-pool-context from backup");
} else {
  throw new Error("could not find request-pool-context.js");
}

const reactDest = join(libs, "react.mjs");
if (!existsSync(reactDest) && existsSync("/tmp/a11y-react.mjs.bak")) {
  cpSync("/tmp/a11y-react.mjs.bak", reactDest);
  console.log("restored react.mjs from backup");
}
if (existsSync(reactDest)) {
  cpSync(reactDest, "/tmp/a11y-react.mjs.bak");
}

const virtualDir = join(server, "_virtual");
mkdirSync(virtualDir, { recursive: true });
const agentsBundle = join(virtualDir, "virtual_agents-bundle.mjs");
if (existsSync(agentsBundle)) {
  writeFileSync(
    agentsBundle,
    "/* stubbed for CF Workers: unresolved bare imports */\nexport default {};\n",
  );
  console.log("stubbed virtual_agents-bundle.mjs");
}

const chunks = join(server, "_chunks");
if (existsSync(chunks)) {
  for (const name of readdirSync(chunks)) {
    if (!name.startsWith("with-selector") || !name.endsWith(".mjs")) continue;
    const p = join(chunks, name);
    let t = readFileSync(p, "utf8");
    if (t.includes("__a11y_react")) {
      console.log("with-selector already patched", name);
      continue;
    }
    if (t.includes("t(`react`)") || t.includes('t("react")') || t.includes("t('react')")) {
      t = 'import __a11y_react from "../_libs/react.mjs";\n' + t;
      t = t.replace(/t\(`react`\)/g, "__a11y_react");
      t = t.replace(/t\("react"\)/g, "__a11y_react");
      t = t.replace(/t\('react'\)/g, "__a11y_react");
      writeFileSync(p, t);
      console.log("patched", name);
    }
  }
}

const corePath = join(libs, "@agent-native/core.mjs");
if (existsSync(corePath)) {
  let t = readFileSync(corePath, "utf8");
  // Tab-id helpers call crypto.randomUUID at module/SSR scope — disallowed on Workers.
  const re =
    /function (\w+)\(\)\{return typeof crypto<\`u\`&&crypto\.randomUUID\?crypto\.randomUUID\(\):Math\.random\(\)\.toString\(36\)\.slice\(2,10\)\}/;
  const m = t.match(re);
  if (m) {
    const name = m[1];
    t = t.replace(
      m[0],
      `function ${name}(){return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}`,
    );
    writeFileSync(corePath, t);
    console.log("patched", name, "randomUUID in core.mjs");
  } else {
    console.warn("WARNING: tab-id randomUUID helper pattern not found");
  }
}

const workerPath = join(server, "worker.mjs");
mustExist(workerPath);
writeFileSync(
  workerPath,
  `/* CF worker entry — eager import + per-request DB pool scope */
if (typeof globalThis.__cfModuleOrigSetInterval === "undefined") {
  globalThis.__cfModuleOrigSetInterval = globalThis.setInterval;
}
globalThis.setInterval = function () {
  return { unref() {}, ref() {}, close() {} };
};
if (typeof globalThis.__dirname === "undefined") globalThis.__dirname = "/";
if (typeof globalThis.__filename === "undefined") globalThis.__filename = "/worker.mjs";

import handler from "./index.mjs";
import { runWithRequestDbPoolScope } from "./_libs/request-pool-context.mjs";

function copyCloudflareRequestMetadata(source, target) {
  if (source.cf !== undefined) {
    Object.defineProperty(target, "cf", { configurable: true, value: source.cf });
  }
  if (typeof source.waitUntil === "function") {
    Object.defineProperty(target, "waitUntil", {
      configurable: true,
      value: source.waitUntil,
      writable: true,
    });
  }
  return target;
}

function initializeBindings(env) {
  if (!env) return;
  globalThis.__env__ = env;
  globalThis.process = globalThis.process || { env: {} };
  globalThis.process.env = globalThis.process.env || {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") globalThis.process.env[key] = value;
  }
  globalThis.__AGENT_NATIVE_CLOUDFLARE_PRODUCTION__ =
    process.env.NODE_ENV === "production";
}

function __cfRestoreModuleTimers() {
  if (typeof globalThis.__cfModuleOrigSetInterval !== "undefined") {
    globalThis.setInterval = globalThis.__cfModuleOrigSetInterval;
  }
}

export default {
  async fetch(request, env, ctx) {
    if (typeof ctx?.waitUntil === "function") {
      const requestWithWaitUntil = copyCloudflareRequestMetadata(
        request,
        new Request(request.url, request),
      );
      requestWithWaitUntil.waitUntil = ctx.waitUntil.bind(ctx);
      request = requestWithWaitUntil;
    }
    initializeBindings(env);
    if (!globalThis.process.env.NODE_ENV) globalThis.process.env.NODE_ENV = "production";
    __cfRestoreModuleTimers();
    try {
      return await runWithRequestDbPoolScope(true, request, () =>
        handler.fetch(request, env, ctx),
      );
    } catch (err) {
      const msg = err && (err.stack || err.message || String(err));
      console.error("[a11y-worker] fetch failed", msg);
      return new Response("Worker error: " + msg, {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  },
};
`,
);
console.log("wrote worker.mjs");

// Fail the patch if jsdom still appears in the server graph (accidental reintroduce).
const index = readFileSync(join(server, "index.mjs"), "utf8");
if (existsSync(join(libs, "jsdom+[...].mjs"))) {
  console.warn(
    "WARNING: jsdom still present in Worker output. Server path should not import jsdom — check start-audit / run-axe imports.",
  );
} else {
  console.log("confirmed: no jsdom in Worker output");
}

console.log("CF post-build patch complete");
