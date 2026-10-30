import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwnerEmail } from "../server/lib/owner.js";

export default defineAction({
  description: "Accept a pending fix proposal and mark the issue fixed.",
  schema: z.object({
    proposalId: z.string().describe("Proposal id"),
  }),
  outputSchema: z.object({
    proposalId: z.string(),
    issueId: z.string(),
    auditId: z.string(),
    status: z.literal("accepted"),
  }),
  deferLoading: false,
  run: async ({ proposalId }, ctx) => {
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

    const decidedAt = new Date().toISOString();
    await db
      .update(schema.proposals)
      .set({ status: "accepted", decidedAt })
      .where(eq(schema.proposals.id, proposalId));

    await db
      .update(schema.issues)
      .set({ status: "fixed" })
      .where(
        and(
          eq(schema.issues.id, proposal.issueId),
          eq(schema.issues.ownerEmail, ownerEmail),
        ),
      );

    await db
      .update(schema.audits)
      .set({
        openIssueCount: sql`GREATEST(${schema.audits.openIssueCount} - 1, 0)`,
      })
      .where(
        and(
          eq(schema.audits.id, proposal.auditId),
          eq(schema.audits.ownerEmail, ownerEmail),
        ),
      );

    return {
      proposalId,
      issueId: proposal.issueId,
      auditId: proposal.auditId,
      status: "accepted" as const,
    };
  },
});
