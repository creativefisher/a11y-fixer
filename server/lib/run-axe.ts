import { Script } from "node:vm";

import axe from "axe-core";
import { JSDOM } from "jsdom";

export type AxeIssue = {
  ruleId: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  help: string;
  description: string;
  helpUrl: string | null;
  selector: string | null;
  html: string | null;
  failureSummary: string | null;
};

type AxeApi = {
  run: (
    context: Document,
    options?: Record<string, unknown>,
  ) => Promise<{
    violations: Array<{
      id: string;
      impact?: string | null;
      help: string;
      description: string;
      helpUrl?: string;
      nodes: Array<{
        impact?: string | null;
        html?: string;
        target?: Array<string | string[]>;
        failureSummary?: string;
      }>;
    }>;
  }>;
};

function normalizeImpact(
  impact: string | null | undefined,
): AxeIssue["impact"] {
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
 * Run axe-core against fetched HTML inside jsdom.
 * Page scripts are NOT executed (safer + avoids site JS blowing up under jsdom).
 * Color-contrast rules are disabled — jsdom cannot compute real styles.
 */
export async function runAxeOnHtml(
  html: string,
  pageUrl: string,
): Promise<AxeIssue[]> {
  const dom = new JSDOM(html, {
    url: pageUrl,
    pretendToBeVisual: true,
    runScripts: "outside-only",
    contentType: "text/html",
  });
  try {
    const context = dom.getInternalVMContext();
    new Script(axe.source).runInContext(context);
    const axeApi = (dom.window as unknown as { axe?: AxeApi }).axe;
    if (!axeApi) {
      throw new Error("axe-core failed to load in jsdom");
    }
    const results = await axeApi.run(dom.window.document, {
      rules: {
        "color-contrast": { enabled: false },
        "color-contrast-enhanced": { enabled: false },
      },
    });

    const issues: AxeIssue[] = [];
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
    dom.window.close();
  }
}
