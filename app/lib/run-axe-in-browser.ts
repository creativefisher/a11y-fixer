import axe from "axe-core";

export type BrowserAxeIssue = {
  ruleId: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  help: string;
  description: string;
  helpUrl: string | null;
  selector: string | null;
  html: string | null;
  failureSummary: string | null;
};

function normalizeImpact(
  impact: string | null | undefined,
): BrowserAxeIssue["impact"] {
  if (
    impact === "critical" ||
    impact === "serious" ||
    impact === "moderate" ||
    impact === "minor"
  ) {
    return impact;
  }
  return "moderate";
}

/**
 * Inject a <base href> so relative CSS/assets resolve to the audited origin
 * (helps color-contrast). Scripts in the snapshot are not executed — the
 * iframe sandbox omits allow-scripts.
 */
function htmlWithBase(html: string, pageUrl: string): string {
  const baseTag = `<base href="${pageUrl.replace(/"/g, "&quot;")}">`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (m) => `${m}${baseTag}`);
  }
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, (m) => `${m}<head>${baseTag}</head>`);
  }
  return `<!doctype html><html><head>${baseTag}</head><body>${html}</body></html>`;
}

/**
 * Run axe-core in the user's browser against a sandboxed iframe (srcdoc).
 * Parent calls axe.run(iframe.contentDocument) — scripts inside the page do
 * not run (no allow-scripts). Restores color-contrast vs the old jsdom path.
 */
export async function runAxeInBrowser(
  html: string,
  pageUrl: string,
): Promise<BrowserAxeIssue[]> {
  if (typeof document === "undefined") {
    throw new Error("runAxeInBrowser requires a browser document");
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin");
  iframe.setAttribute("title", "Accessibility audit sandbox");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1280px;height:800px;opacity:0;pointer-events:none;border:0";
  iframe.srcdoc = htmlWithBase(html, pageUrl);
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("Audit iframe load timed out")),
        20_000,
      );
      iframe.addEventListener(
        "load",
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });

    // Allow stylesheets linked via <base> a brief moment to apply.
    await new Promise((r) => window.setTimeout(r, 150));

    const doc = iframe.contentDocument;
    if (!doc) {
      throw new Error("Audit iframe document unavailable");
    }

    const results = await axe.run(doc, {
      // Keep defaults including color-contrast — real computed styles in browser.
      resultTypes: ["violations"],
    });

    const issues: BrowserAxeIssue[] = [];
    for (const violation of results.violations) {
      for (const node of violation.nodes) {
        issues.push({
          ruleId: violation.id,
          impact: normalizeImpact(violation.impact ?? node.impact),
          help: violation.help,
          description: violation.description,
          helpUrl: violation.helpUrl ?? null,
          selector: node.target?.map(String).join(" ") || null,
          html: node.html ?? null,
          failureSummary: node.failureSummary ?? null,
        });
      }
    }
    return issues;
  } finally {
    iframe.remove();
  }
}
