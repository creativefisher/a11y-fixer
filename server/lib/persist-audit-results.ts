import { eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import type { AxeIssue } from "./axe-issue.js";
import { MAX_ISSUES_PER_AUDIT } from "./audit-limits.js";
import { scoreFromOpenIssues } from "./score.js";

export async function persistAuditFindings(opts: {
  auditId: string;
  ownerEmail: string;
  findings: AxeIssue[];
  limitations: string;
}): Promise<{
  status: "completed";
  score: number;
  issueCount: number;
  openIssueCount: number;
  limitations: string;
}> {
  const db = getDb();
  const findings = opts.findings.slice(0, MAX_ISSUES_PER_AUDIT);
  const impacts = findings.map((f) => f.impact);
  const score = scoreFromOpenIssues(impacts);
  const completedAt = new Date().toISOString();

  if (findings.length > 0) {
    await db.insert(schema.issues).values(
      findings.map((finding) => ({
        id: crypto.randomUUID(),
        auditId: opts.auditId,
        ruleId: finding.ruleId,
        impact: finding.impact,
        help: finding.help,
        description: finding.description,
        helpUrl: finding.helpUrl,
        selector: finding.selector,
        html: finding.html,
        failureSummary: finding.failureSummary,
        status: "open" as const,
        ownerEmail: opts.ownerEmail,
        createdAt: completedAt,
      })),
    );
  }

  await db
    .update(schema.audits)
    .set({
      status: "completed",
      score,
      issueCount: findings.length,
      openIssueCount: findings.length,
      completedAt,
      errorMessage: null,
      limitations: opts.limitations,
    })
    .where(eq(schema.audits.id, opts.auditId));

  return {
    status: "completed",
    score,
    issueCount: findings.length,
    openIssueCount: findings.length,
    limitations: opts.limitations,
  };
}
