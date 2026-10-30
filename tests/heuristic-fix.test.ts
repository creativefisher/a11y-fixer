import { describe, expect, it } from "vitest";

import {
  heuristicFix,
  mockFix,
  shouldMockLlm,
} from "../server/lib/heuristic-fix.js";
import { scoreFromOpenIssues } from "../server/lib/score.js";

describe("heuristicFix", () => {
  it("adds alt text for image-alt", () => {
    const draft = heuristicFix({
      ruleId: "image-alt",
      html: '<img src="/x.png">',
      help: "Images must have alternate text",
      failureSummary: null,
      selector: "img",
    });
    expect(draft).not.toBeNull();
    expect(draft?.afterHtml).toMatch(/alt=/);
    expect(draft?.source).toBe("heuristic");
  });


  it("adds aria-label when a link only wraps an image", () => {
    const draft = heuristicFix({
      ruleId: "link-name",
      html: '<a href="/x"><img src="/x.png" alt=""></a>',
      help: "Links must have discernible text",
      failureSummary: null,
      selector: "a",
    });
    expect(draft?.afterHtml).toMatch(/aria-label=/);
  });

  it("returns null for unknown rules so Builder can handle them", () => {
    expect(
      heuristicFix({
        ruleId: "aria-required-children",
        html: '<div role="list"></div>',
        help: "Certain ARIA roles must contain specific children",
        failureSummary: null,
        selector: "div",
      }),
    ).toBeNull();
  });
});

describe("mockFix", () => {
  it("always returns a draft", () => {
    const draft = mockFix({
      ruleId: "aria-required-children",
      html: "<div></div>",
      help: "help",
      selector: "div",
    });
    expect(draft.source).toBe("mock");
    expect(draft.afterHtml).toContain("fixed: aria-required-children");
  });
});

describe("shouldMockLlm", () => {
  it("reads A11Y_MOCK_LLM", () => {
    const previous = process.env.A11Y_MOCK_LLM;
    process.env.A11Y_MOCK_LLM = "true";
    expect(shouldMockLlm()).toBe(true);
    process.env.A11Y_MOCK_LLM = "0";
    expect(shouldMockLlm()).toBe(false);
    if (previous === undefined) delete process.env.A11Y_MOCK_LLM;
    else process.env.A11Y_MOCK_LLM = previous;
  });
});

describe("scoreFromOpenIssues", () => {
  it("starts at 100 and drops by impact", () => {
    expect(scoreFromOpenIssues([])).toBe(100);
    expect(scoreFromOpenIssues(["critical", "minor"])).toBe(94);
  });
});
