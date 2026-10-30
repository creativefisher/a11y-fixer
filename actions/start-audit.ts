import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { AUDIT_LIMITATIONS } from "../server/lib/audit-limits.js";
import { fetchPageHtml, normalizeAuditUrl } from "../server/lib/fetch-html.js";
import { requireOwnerEmail } from "../server/lib/owner.js";
import { runAxeOnHtml } from "../server/lib/run-axe.js";
import { scoreFromOpenIssues } from "../server/lib/score.js";

export default defineAction({
  description:
    "Fetch a public URL, run an axe-core accessibility audit (HTML + jsdom; no color-contrast), and store issues. Returns auditId.",
  schema: z.object({
    url: z.string().describe("Public http(s) URL to audit"),
  }),
  outputSchema: z.object({
    auditId: z.string(),
    status: z.enum(["completed", "failed"]),
    score: z.number().nullable(),
    issueCount: z.number(),
    openIssueCount: z.number(),
    limitations: z.string(),
    errorMessage: z.string().nullable(),
  }),
  deferLoading: false,
  run: async ({ url }, ctx) => {
    const ownerEmail = requireOwnerEmail(ctx);
    const parsed = normalizeAuditUrl(url);
    const auditId = crypto.randomUUID();
    const db = getDb();
    const now = new Date().toISOString();

    await db.insert(schema.audits).values({
      id: auditId,
      url: parsed.toString(),
      status: "running",
      score: null,
      issueCount: 0,
      openIssueCount: 0,
      errorMessage: null,
      limitations: AUDIT_LIMITATIONS,
      ownerEmail,
      createdAt: now,
      completedAt: null,
    });

    try {
      const html = await fetchPageHtml(parsed);
      const findings = await runAxeOnHtml(html, parsed.toString());
      const impacts = findings.map((f) => f.impact);
      const score = scoreFromOpenIssues(impacts);
      const completedAt = new Date().toISOString();

      if (findings.length > 0) {
        await db.insert(schema.issues).values(
          findings.map((finding) => ({
            id: crypto.randomUUID(),
            auditId,
            ruleId: finding.ruleId,
            impact: finding.impact,
            help: finding.help,
            description: finding.description,
            helpUrl: finding.helpUrl,
            selector: finding.selector,
            html: finding.html,
            failureSummary: finding.failureSummary,
            status: "open" as const,
            ownerEmail,
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
        })
        .where(eq(schema.audits.id, auditId));

      return {
        auditId,
        status: "completed" as const,
        score,
        issueCount: findings.length,
        openIssueCount: findings.length,
        limitations: AUDIT_LIMITATIONS,
        errorMessage: null,
      };
    } catch (error) {
      const message =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message.replace(/^Action \S+ failed:\s*/, "")
          : "Audit failed.";
      const errorCode =
        error &&
        typeof error === "object" &&
        "errorCode" in error &&
        typeof (error as { errorCode: unknown }).errorCode === "string"
          ? (error as { errorCode: string }).errorCode
          : "audit_failed";
      const statusCode =
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        typeof (error as { statusCode: unknown }).statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;

      await db
        .update(schema.audits)
        .set({
          status: "failed",
          errorMessage: message,
          completedAt: new Date().toISOString(),
        })
        .where(eq(schema.audits.id, auditId));

      // Re-throw contract failures as-is; otherwise wrap.
      if (error && typeof error === "object" && "errorCode" in error) {
        throw error;
      }
      fail(message, { errorCode, statusCode });
    }
  },
});
