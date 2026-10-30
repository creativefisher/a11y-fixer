import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwnerEmail } from "../server/lib/owner.js";

export default defineAction({
  description: "Get one accessibility audit by id for the signed-in user.",
  schema: z.object({
    auditId: z.string().describe("Audit id returned by start-audit"),
  }),
  http: { method: "GET" },
  outputSchema: z.object({
    auditId: z.string(),
    url: z.string(),
    status: z.enum(["pending", "running", "completed", "failed"]),
    score: z.number().nullable(),
    issueCount: z.number(),
    openIssueCount: z.number(),
    limitations: z.string().nullable(),
    errorMessage: z.string().nullable(),
    createdAt: z.string(),
    completedAt: z.string().nullable(),
  }),
  deferLoading: false,
  run: async ({ auditId }, ctx) => {
    const ownerEmail = requireOwnerEmail(ctx);
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.audits)
      .where(
        and(eq(schema.audits.id, auditId), eq(schema.audits.ownerEmail, ownerEmail)),
      )
      .limit(1);
    if (!row) {
      fail("Audit not found.", { errorCode: "not_found", statusCode: 404 });
    }
    return {
      auditId: row.id,
      url: row.url,
      status: row.status,
      score: row.score,
      issueCount: row.issueCount,
      openIssueCount: row.openIssueCount,
      limitations: row.limitations,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  },
});
