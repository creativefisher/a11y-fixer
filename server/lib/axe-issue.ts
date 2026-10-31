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

export function normalizeImpact(
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
