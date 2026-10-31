import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  AUDIT_LIMITATIONS_BROWSER,
  MAX_ISSUES_PER_AUDIT,
} from "../server/lib/audit-limits.js";
import { requireOwnerEmail } from "../server/lib/owner.js";
import { persistAuditFindings } from "../server/lib/persist-audit-results.js";

const issueSchema = z.object({
  ruleId: z.string().min(1).max(200),
  impact: z.enum(["critical", "serious", "moderate", "minor"]),
  help: z.string().max(2000),
  description: z.string().max(8000),
  helpUrl: z.string().max(2000).nullable(),
  selector: z.string().max(2000).nullable(),
  html: z.string().max(20_000).nullable(),
  failureSummary: z.string().max(8000).nullable(),
});

export default defineAction({
  description:
    "Save axe-core findings from the browser sandboxed run (or any trusted client) for an audit created by start-audit. Owner-scoped; rejects audits that are already completed.",
  schema: z.object({
    auditId: z.string().describe("Audit id from start-audit"),
    issues: z
      .array(issueSchema)
      .max(MAX_ISSUES_PER_AUDIT)
      .describe("Axe violation nodes from the browser run"),
  }),
  outputSchema: z.object({
    auditId: z.string(),
    status: z.enum(["completed"]),
    score: z.number(),
    issueCount: z.number(),
    openIssueCount: z.number(),
    limitations: z.string(),
  }),
  deferLoading: false,
  run: async ({ auditId, issues }, ctx) => {
    const ownerEmail = requireOwnerEmail(ctx);
    const db = getDb();

    const [audit] = await db
      .select()
      .from(schema.audits)
      .where(
        and(eq(schema.audits.id, auditId), eq(schema.audits.ownerEmail, ownerEmail)),
      )
      .limit(1);
    if (!audit) {
      fail("Audit not found.", { errorCode: "not_found", statusCode: 404 });
    }
    if (audit.status === "completed") {
      fail("Audit is already completed.", {
        errorCode: "already_completed",
        statusCode: 409,
      });
    }
    if (audit.status === "failed") {
      fail("Audit previously failed; start a new one.", {
        errorCode: "audit_failed",
        statusCode: 409,
      });
    }

    const saved = await persistAuditFindings({
      auditId,
      ownerEmail,
      findings: issues,
      limitations: audit.limitations || AUDIT_LIMITATIONS_BROWSER,
    });

    return {
      auditId,
      status: "completed" as const,
      score: saved.score,
      issueCount: saved.issueCount,
      openIssueCount: saved.openIssueCount,
      limitations: saved.limitations,
    };
  },
});
