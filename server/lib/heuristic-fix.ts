import type { AxeIssue } from "./axe-issue.js";

export type FixProposalDraft = {
  beforeHtml: string;
  afterHtml: string;
  rationale: string;
  source: "heuristic" | "mock";
};

/**
 * Deterministic, no-LLM fix proposals for common axe rules.
 * Keeps Builder free credits for harder cases the agent must draft.
 */
export function heuristicFix(issue: Pick<
  AxeIssue,
  "ruleId" | "html" | "help" | "failureSummary" | "selector"
>): FixProposalDraft | null {
  const before = (issue.html ?? "").trim() || `<!-- ${issue.selector ?? issue.ruleId} -->`;
  const rule = issue.ruleId;

  if (rule === "image-alt") {
    const after = before.includes("<img")
      ? before.replace(/<img\b([^>]*)>/i, (_m, attrs: string) => {
          if (/\balt\s*=/.test(attrs)) {
            return `<img${attrs.replace(/\balt\s*=\s*(["'])[^"']*\1/, 'alt="Describe this image"')}>`;
          }
          return `<img alt="Describe this image"${attrs}>`;
        })
      : before;
    return {
      beforeHtml: before,
      afterHtml: after,
      rationale:
        "Images need a short alt text that describes the image for screen-reader users. Replace the placeholder with a real description, or use alt=\"\" if the image is decorative.",
      source: "heuristic",
    };
  }

  if (rule === "button-name" || rule === "input-button-name") {
    const after = /<button\b/i.test(before)
      ? before.replace(
          /<button\b([^>]*)>([\s\S]*?)<\/button>/i,
          (_m, attrs: string, inner: string) => {
            if (inner.trim()) return `<button${attrs}>${inner}</button>`;
            if (/\baria-label\s*=/.test(attrs)) {
              return `<button${attrs}>${inner}</button>`;
            }
            return `<button aria-label="Describe this action"${attrs}>${inner}</button>`;
          },
        )
      : before.includes("aria-label")
        ? before
        : before.replace(/<(\w+)(\b[^>]*?)(\/?)>/, `<$1 aria-label="Describe this action"$2$3>`);
    return {
      beforeHtml: before,
      afterHtml: after,
      rationale:
        "Controls need an accessible name. Add visible text inside the button, or an aria-label that names the action.",
      source: "heuristic",
    };
  }

  if (rule === "link-name") {
    const after = /<a\b/i.test(before)
      ? before.replace(
          /<a\b([^>]*)>([\s\S]*?)<\/a>/i,
          (_m, attrs: string, inner: string) => {
            if (/\baria-label\s*=/.test(attrs)) return `<a${attrs}>${inner}</a>`;
            // Strip tags to see if there is real link text (images alone don't count).
            const textOnly = inner.replace(/<[^>]+>/g, "").trim();
            if (textOnly) return `<a${attrs}>${inner}</a>`;
            return `<a aria-label="Describe this link"${attrs}>${inner}</a>`;
          },
        )
      : before;
    return {
      beforeHtml: before,
      afterHtml: after,
      rationale:
        "Links need accessible text. Put clear link text inside the anchor, or add aria-label.",
      source: "heuristic",
    };
  }

  if (rule === "label" || rule === "select-name" || rule === "form-field-multiple-labels") {
    const after = before.includes("aria-label")
      ? before
      : before.replace(/<(input|select|textarea)\b/i, `<$1 aria-label="Field label"`);
    return {
      beforeHtml: before,
      afterHtml: after,
      rationale:
        "Form fields need an associated <label> (preferred) or an aria-label so assistive tech can name them.",
      source: "heuristic",
    };
  }

  if (rule === "html-has-lang" || rule === "html-lang-valid") {
    const after = /<html\b/i.test(before)
      ? before.replace(/<html\b([^>]*)>/i, (_m, attrs: string) => {
          if (/\blang\s*=/.test(attrs)) {
            return `<html${attrs.replace(/\blang\s*=\s*(["'])[^"']*\1/, 'lang="en"')}>`;
          }
          return `<html lang="en"${attrs}>`;
        })
      : `<html lang="en">…</html>`;
    return {
      beforeHtml: before,
      afterHtml: after,
      rationale:
        "Set lang on the <html> element to the page's language (for example lang=\"en\").",
      source: "heuristic",
    };
  }

  if (rule === "document-title") {
    return {
      beforeHtml: before.includes("<title") ? before : "<head>…</head>",
      afterHtml: "<title>Descriptive page title</title>",
      rationale: "Every page needs a unique, descriptive <title> in the document head.",
      source: "heuristic",
    };
  }

  if (rule === "bypass" || rule === "skip-link") {
    return {
      beforeHtml: before || "<!-- top of <body> -->",
      afterHtml: `<a href="#main" class="skip-link">Skip to main content</a>\n${before}`,
      rationale:
        "Add a skip link as the first focusable element so keyboard users can jump past repeated chrome.",
      source: "heuristic",
    };
  }

  // No safe deterministic rewrite — caller may ask the agent / Builder.
  return null;
}

/** Test-only mock proposal when heuristics don't cover a rule. */
export function mockFix(issue: Pick<AxeIssue, "ruleId" | "html" | "help" | "selector">): FixProposalDraft {
  const before = (issue.html ?? "").trim() || `<!-- ${issue.selector ?? issue.ruleId} -->`;
  return {
    beforeHtml: before,
    afterHtml: `<!-- fixed: ${issue.ruleId} -->\n${before}`,
    rationale: `Mock fix for ${issue.ruleId}: ${issue.help}. Connect Builder.io for a real agent-authored proposal.`,
    source: "mock",
  };
}

export function shouldMockLlm(): boolean {
  const value = process.env.A11Y_MOCK_LLM?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
