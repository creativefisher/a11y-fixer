export type IssueImpact = "critical" | "serious" | "moderate" | "minor";

const IMPACT_WEIGHT: Record<IssueImpact, number> = {
  critical: 5,
  serious: 3,
  moderate: 2,
  minor: 1,
};

export function impactWeight(impact: string): number {
  return IMPACT_WEIGHT[impact as IssueImpact] ?? 2;
}

/** Score from open issues. 100 = clean. Drops by impact weight. */
export function scoreFromOpenIssues(
  impacts: ReadonlyArray<string>,
): number {
  const penalty = impacts.reduce((sum, impact) => sum + impactWeight(impact), 0);
  return Math.max(0, 100 - penalty);
}
