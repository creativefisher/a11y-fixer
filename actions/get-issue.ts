import { defineAction, fail } from "@agent-native/core/action";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwnerEmail } from "../server/lib/owner.js";

export default defineAction({
  description: "Get full details for one accessibility issue, including latest proposal if any.",
  schema: z.object({
    issueId: z.string().describe("Issue id"),
  }),
  http: { method: "GET" },
  outputSchema: z.object({
    id: z.string(),
    auditId: z.string(),
    ruleId: z.string(),
    impact: z.enum(["critical", "serious", "moderate", "minor"]),
    help: z.string(),
    description: z.string(),
    helpUrl: z.string().nullable(),
    selector: z.string().nullable(),
    html: z.string().nullable(),
    failureSummary: z.string().nullable(),
    status: z.enum(["open", "fixed", "ignored"]),
    latestProposal: z
      .object({
        id: z.string(),
        beforeHtml: z.string(),
        afterHtml: z.string(),
        rationale: z.string(),
        source: z.enum(["heuristic", "agent", "mock"]),
        status: z.enum(["pending", "accepted", "rejected"]),
      })
      .nullable(),
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

    const [proposal] = await db
      .select()
      .from(schema.proposals)
      .where(
        and(
          eq(schema.proposals.issueId, issueId),
          eq(schema.proposals.ownerEmail, ownerEmail),
        ),
      )
      .orderBy(desc(schema.proposals.createdAt))
      .limit(1);

    return {
      id: issue.id,
      auditId: issue.auditId,
      ruleId: issue.ruleId,
      impact: issue.impact,
      help: issue.help,
      description: issue.description,
      helpUrl: issue.helpUrl,
      selector: issue.selector,
      html: issue.html,
      failureSummary: issue.failureSummary,
      status: issue.status,
      latestProposal: proposal
        ? {
            id: proposal.id,
            beforeHtml: proposal.beforeHtml,
            afterHtml: proposal.afterHtml,
            rationale: proposal.rationale,
            source: proposal.source,
            status: proposal.status,
          }
        : null,
    };
  },
});
