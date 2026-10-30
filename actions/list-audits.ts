import { defineAction } from "@agent-native/core/action";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwnerEmail } from "../server/lib/owner.js";

export default defineAction({
  description: "List recent accessibility audits for the signed-in user.",
  schema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Max audits to return"),
  }),
  http: { method: "GET" },
  outputSchema: z.object({
    audits: z.array(
      z.object({
        id: z.string(),
        url: z.string(),
        status: z.enum(["pending", "running", "completed", "failed"]),
        score: z.number().nullable(),
        issueCount: z.number(),
        openIssueCount: z.number(),
        createdAt: z.string(),
        completedAt: z.string().nullable(),
        errorMessage: z.string().nullable(),
      }),
    ),
  }),
  deferLoading: false,
  run: async ({ limit }, ctx) => {
    const ownerEmail = requireOwnerEmail(ctx);
    const db = getDb();
    const rows = await db
      .select({
        id: schema.audits.id,
        url: schema.audits.url,
        status: schema.audits.status,
        score: schema.audits.score,
        issueCount: schema.audits.issueCount,
        openIssueCount: schema.audits.openIssueCount,
        createdAt: schema.audits.createdAt,
        completedAt: schema.audits.completedAt,
        errorMessage: schema.audits.errorMessage,
      })
      .from(schema.audits)
      .where(eq(schema.audits.ownerEmail, ownerEmail))
      .orderBy(desc(schema.audits.createdAt))
      .limit(limit);

    return { audits: rows };
  },
});
