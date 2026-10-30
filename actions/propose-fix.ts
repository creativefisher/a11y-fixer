import { defineAction, fail } from "@agent-native/core/action";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  heuristicFix,
  mockFix,
  shouldMockLlm,
} from "../server/lib/heuristic-fix.js";
import { requireOwnerEmail } from "../server/lib/owner.js";

export default defineAction({
  description:
    "Propose a before/after HTML fix for one accessibility issue. Prefers a free heuristic; falls back to mock when A11Y_MOCK_LLM is set; otherwise returns needs_builder so the user can connect Builder.io free credits.",
  schema: z.object({
    issueId: z.string().describe("Issue id from list-issues / get-issue"),
  }),
  outputSchema: z.object({
    status: z.enum(["proposed", "needs_builder", "already_proposed"]),
    proposalId: z.string().nullable(),
    issueId: z.string(),
    beforeHtml: z.string().nullable(),
    afterHtml: z.string().nullable(),
    rationale: z.string().nullable(),
    source: z.enum(["heuristic", "agent", "mock"]).nullable(),
    message: z.string(),
  }),
  deferLoading: false,
  run: async ({ issueId }, ctx) => {
    const ownerEmail = requireOwnerEmail(ctx);
    const db = getDb();

    const [issue] = await db
      .select()
      .from(schema.issues)
      .where(
        and(eq(schema.issues.id, issueId), eq(schema.issues.ownerEmail, ownerEmail)),
      )
      .limit(1);
    if (!issue) {
      fail("Issue not found.", { errorCode: "not_found", statusCode: 404 });
    }

    const [existing] = await db
      .select()
      .from(schema.proposals)
      .where(
        and(
          eq(schema.proposals.issueId, issueId),
          eq(schema.proposals.ownerEmail, ownerEmail),
          eq(schema.proposals.status, "pending"),
        ),
      )
      .orderBy(desc(schema.proposals.createdAt))
      .limit(1);

    if (existing) {
      return {
        status: "already_proposed" as const,
        proposalId: existing.id,
        issueId,
        beforeHtml: existing.beforeHtml,
        afterHtml: existing.afterHtml,
        rationale: existing.rationale,
        source: existing.source,
        message: "A pending proposal already exists for this issue.",
      };
    }

    const draft =
      heuristicFix(issue) ?? (shouldMockLlm() ? mockFix(issue) : null);

    if (!draft) {
      return {
        status: "needs_builder" as const,
        proposalId: null,
        issueId,
        beforeHtml: issue.html,
        afterHtml: null,
        rationale: null,
        source: null,
        message:
          "No free heuristic covers this rule. Connect Builder.io (Use Builder.io) in Settings → AI to generate a fix with free credits, or set A11Y_MOCK_LLM=true for offline demos.",
      };
    }

    const proposalId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(schema.proposals).values({
      id: proposalId,
      issueId,
      auditId: issue.auditId,
      beforeHtml: draft.beforeHtml,
      afterHtml: draft.afterHtml,
      rationale: draft.rationale,
      source: draft.source,
      status: "pending",
      rejectReason: null,
      ownerEmail,
      createdAt: now,
      decidedAt: null,
    });

    return {
      status: "proposed" as const,
      proposalId,
      issueId,
      beforeHtml: draft.beforeHtml,
      afterHtml: draft.afterHtml,
      rationale: draft.rationale,
      source: draft.source,
      message: `Proposed a ${draft.source} fix.`,
    };
  },
});
