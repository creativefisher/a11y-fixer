import { defineAction, fail } from "@agent-native/core/action";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwnerEmail } from "../server/lib/owner.js";

export default defineAction({
  description: "List accepted fix proposals for an audit (the user's fix checklist).",
  schema: z.object({
    auditId: z.string().describe("Audit id"),
  }),
  http: { method: "GET" },
  outputSchema: z.object({
    auditId: z.string(),
    fixes: z.array(
      z.object({
        proposalId: z.string(),
        issueId: z.string(),
        ruleId: z.string(),
        help: z.string(),
        beforeHtml: z.string(),
        afterHtml: z.string(),
        rationale: z.string(),
        decidedAt: z.string().nullable(),
      }),
    ),
  }),
  deferLoading: false,
  run: async ({ auditId }, ctx) => {
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
      .select({
        proposalId: schema.proposals.id,
        issueId: schema.proposals.issueId,
        beforeHtml: schema.proposals.beforeHtml,
        afterHtml: schema.proposals.afterHtml,
        rationale: schema.proposals.rationale,
        decidedAt: schema.proposals.decidedAt,
        ruleId: schema.issues.ruleId,
        help: schema.issues.help,
      })
      .from(schema.proposals)
      .innerJoin(schema.issues, eq(schema.issues.id, schema.proposals.issueId))
      .where(
        and(
          eq(schema.proposals.auditId, auditId),
          eq(schema.proposals.ownerEmail, ownerEmail),
          eq(schema.proposals.status, "accepted"),
        ),
      )
      .orderBy(desc(schema.proposals.decidedAt));

    return {
      auditId,
      fixes: rows.map((row) => ({
        proposalId: row.proposalId,
        issueId: row.issueId,
        ruleId: row.ruleId,
        help: row.help,
        beforeHtml: row.beforeHtml,
        afterHtml: row.afterHtml,
        rationale: row.rationale,
        decidedAt: row.decidedAt,
      })),
    };
  },
});
