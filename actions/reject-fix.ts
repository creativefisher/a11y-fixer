import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwnerEmail } from "../server/lib/owner.js";

export default defineAction({
  description: "Reject a pending fix proposal. The issue stays open.",
  schema: z.object({
    proposalId: z.string().describe("Proposal id"),
    reason: z
      .string()
      .optional()
      .describe("Optional short reason the proposal was rejected"),
  }),
  outputSchema: z.object({
    proposalId: z.string(),
    issueId: z.string(),
    status: z.literal("rejected"),
  }),
  deferLoading: false,
  run: async ({ proposalId, reason }, ctx) => {
    const ownerEmail = requireOwnerEmail(ctx);
    const db = getDb();
    const [proposal] = await db
      .select()
      .from(schema.proposals)
      .where(
        and(
          eq(schema.proposals.id, proposalId),
          eq(schema.proposals.ownerEmail, ownerEmail),
        ),
      )
      .limit(1);
    if (!proposal) {
      fail("Proposal not found.", { errorCode: "not_found", statusCode: 404 });
    }
    if (proposal.status !== "pending") {
      fail(`Proposal is already ${proposal.status}.`, {
        errorCode: "already_decided",
        statusCode: 409,
      });
    }

    await db
      .update(schema.proposals)
      .set({
        status: "rejected",
        rejectReason: reason?.trim() || null,
        decidedAt: new Date().toISOString(),
      })
      .where(eq(schema.proposals.id, proposalId));

    return {
      proposalId,
      issueId: proposal.issueId,
      status: "rejected" as const,
    };
  },
});
