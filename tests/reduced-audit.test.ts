import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runReducedAuditOnHtml } from "../server/lib/reduced-audit.js";

const fixtureHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../fixtures/bad-a11y.html"),
  "utf8",
);

describe("runReducedAuditOnHtml", () => {
  it("flags known issues on the bad-a11y fixture", () => {
    const issues = runReducedAuditOnHtml(fixtureHtml);
    const ruleIds = new Set(issues.map((issue) => issue.ruleId));
    expect(ruleIds.has("image-alt")).toBe(true);
    expect(ruleIds.has("button-name") || ruleIds.has("link-name")).toBe(true);
    expect(ruleIds.has("html-has-lang")).toBe(true);
    expect(issues.length).toBeGreaterThan(2);
  });

  it("passes a clean minimal page", () => {
    const html = `<!doctype html><html lang="en"><head><title>Ok</title></head><body>
      <main><h1>Hi</h1><img src="x.png" alt="x"><a href="/">Home</a><button type="button">Go</button></main>
    </body></html>`;
    expect(runReducedAuditOnHtml(html)).toEqual([]);
  });
});
