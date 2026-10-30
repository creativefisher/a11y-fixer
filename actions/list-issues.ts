import { defineAction, fail } from "@agent-native/core/action";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwnerEmail } from "../server/lib/owner.js";

const impactOrder = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
} as const;

export default defineAction({
  description:
    "List accessibility issues for an audit, optionally filtered by severity. Sorted critical → minor.",
  schema: z.object({
    auditId: z.string().describe("Audit id"),
    severity: z
      .enum(["critical", "serious", "moderate", "minor"])
      .optional()
      .describe("Optional impact filter"),
  }),
  http: { method: "GET" },
  outputSchema: z.object({
    auditId: z.string(),
    issues: z.array(
      z.object({
        id: z.string(),
        ruleId: z.string(),
        impact: z.enum(["critical", "serious", "moderate", "minor"]),
        help: z.string(),
        selector: z.string().nullable(),
        status: z.enum(["open", "fixed", "ignored"]),
        message: z.string(),
      }),
    ),
  }),
  deferLoading: false,
  run: async ({ auditId, severity }, ctx) => {
    const ownerEmail = requireOwnerEmail(ctx);
    const db = getDb();
    const [audit] = await db
      .select({ id: schema.audits.id })
      .from(schema.audits)
      .where(
        and(eq(schema.audits.id, auditId), eq(schema.audits.ownerEmail, ownerEmail)),
      )
      .limit(1);
    if (!audit) {
      fail("Audit not found.", { errorCode: "not_found", statusCode: 404 });
    }

    const rows = await db
      .select()
      .from(schema.issues)
      .where(
        and(
          eq(schema.issues.auditId, auditId),
          eq(schema.issues.ownerEmail, ownerEmail),
          ...(severity ? [eq(schema.issues.impact, severity)] : []),
        ),
      )
      .orderBy(asc(schema.issues.createdAt));

    const issues = rows
      .map((row) => ({
        id: row.id,
        ruleId: row.ruleId,
        impact: row.impact,
        help: row.help,
        selector: row.selector,
        status: row.status,
        message: row.failureSummary || row.description,
      }))
      .sort(
        (a, b) =>
          (impactOrder[a.impact] ?? 9) - (impactOrder[b.impact] ?? 9) ||
          a.ruleId.localeCompare(b.ruleId),
      );

    return { auditId, issues };
  },
});
