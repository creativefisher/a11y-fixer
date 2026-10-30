import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runAxeOnHtml } from "../server/lib/run-axe.js";

const fixtureHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../fixtures/bad-a11y.html"),
  "utf8",
);

describe("runAxeOnHtml", () => {
  it("flags known issues on the bad-a11y fixture", async () => {
    const issues = await runAxeOnHtml(
      fixtureHtml,
      "https://fixture.local/bad-a11y.html",
    );
    const ruleIds = new Set(issues.map((issue) => issue.ruleId));
    expect(ruleIds.has("image-alt")).toBe(true);
    expect(ruleIds.has("button-name") || ruleIds.has("input-button-name")).toBe(
      true,
    );
    expect(ruleIds.has("link-name")).toBe(true);
    expect(ruleIds.has("html-has-lang")).toBe(true);
    // Color contrast must stay disabled under jsdom.
    expect(ruleIds.has("color-contrast")).toBe(false);
    expect(issues.length).toBeGreaterThan(3);
  });
});
