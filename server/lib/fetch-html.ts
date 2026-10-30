import { fail } from "@agent-native/core/action";

import { FETCH_TIMEOUT_MS, MAX_HTML_BYTES } from "./audit-limits.js";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  // Basic IPv4 private ranges
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

export function normalizeAuditUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    fail("Enter a valid http(s) URL.", {
      errorCode: "invalid_url",
      statusCode: 400,
    });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail("Only http and https URLs are supported.", {
      errorCode: "invalid_url",
      statusCode: 400,
    });
  }
  // Allow loopback only when explicitly opted in for local fixture demos.
  const allowLocal = process.env.A11Y_ALLOW_LOCAL_FETCH === "true";
  if (!allowLocal && isPrivateHostname(parsed.hostname)) {
    fail("That host cannot be audited (private or local address).", {
      errorCode: "blocked_host",
      statusCode: 400,
    });
  }
  return parsed;
}

export async function fetchPageHtml(url: URL): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "AccessibilityFixer/0.1 (+https://github.com/creativefisher/a11y-fixer; hackathon)",
      },
    });
    if (!response.ok) {
      fail(`Could not fetch the page (HTTP ${response.status}).`, {
        errorCode: "fetch_failed",
        statusCode: 502,
      });
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (
      contentType &&
      !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)
    ) {
      fail(`URL did not return HTML (got ${contentType}).`, {
        errorCode: "not_html",
        statusCode: 400,
      });
    }
    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader && Number(lengthHeader) > MAX_HTML_BYTES) {
      fail("Page HTML is too large to audit.", {
        errorCode: "html_too_large",
        statusCode: 413,
      });
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) {
      fail("Page HTML is too large to audit.", {
        errorCode: "html_too_large",
        statusCode: 413,
      });
    }
    return new TextDecoder("utf-8").decode(buffer);
  } catch (error) {
    if (error && typeof error === "object" && "errorCode" in error) throw error;
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Timed out fetching the page."
        : "Could not fetch the page.";
    fail(message, { errorCode: "fetch_failed", statusCode: 502 });
  } finally {
    clearTimeout(timer);
  }
}
