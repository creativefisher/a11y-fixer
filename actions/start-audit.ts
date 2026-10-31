import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  AUDIT_LIMITATIONS_BROWSER,
  AUDIT_LIMITATIONS_SERVER,
} from "../server/lib/audit-limits.js";
import { fetchPageHtml, normalizeAuditUrl } from "../server/lib/fetch-html.js";
import { requireOwnerEmail } from "../server/lib/owner.js";
import { persistAuditFindings } from "../server/lib/persist-audit-results.js";
import { runReducedAuditOnHtml } from "../server/lib/reduced-audit.js";

export default defineAction({
  description:
    "Fetch a public URL's HTML (SSRF-safe). Default execution=client returns HTML so the Audits UI can run full axe-core in a sandboxed iframe (includes color-contrast), then call complete-audit. execution=server runs a reduced Workers-safe check (no jsdom) and completes immediately — use this for agents without a browser.",
  schema: z.object({
    url: z.string().describe("Public http(s) URL to audit"),
    execution: z
      .enum(["client", "server"])
      .optional()
      .describe(
        "client (default): return HTML for browser axe + complete-audit. server: reduced audit now.",
      ),
  }),
  outputSchema: z.object({
    auditId: z.string(),
    status: z.enum(["awaiting_browser", "completed", "failed"]),
    url: z.string(),
    html: z.string().nullable(),
    score: z.number().nullable(),
    issueCount: z.number(),
    openIssueCount: z.number(),
    limitations: z.string(),
    errorMessage: z.string().nullable(),
  }),
  deferLoading: false,
  run: async ({ url, execution }, ctx) => {
    const ownerEmail = requireOwnerEmail(ctx);
    const mode = execution ?? "client";
    const parsed = normalizeAuditUrl(url);
    const auditId = crypto.randomUUID();
    const db = getDb();
    const now = new Date().toISOString();
    const limitations =
      mode === "server" ? AUDIT_LIMITATIONS_SERVER : AUDIT_LIMITATIONS_BROWSER;

    await db.insert(schema.audits).values({
      id: auditId,
      url: parsed.toString(),
      status: "running",
      score: null,
      issueCount: 0,
      openIssueCount: 0,
      errorMessage: null,
      limitations,
      ownerEmail,
      createdAt: now,
      completedAt: null,
    });

    try {
      const html = await fetchPageHtml(parsed);

      if (mode === "server") {
        const findings = runReducedAuditOnHtml(html);
        const saved = await persistAuditFindings({
          auditId,
          ownerEmail,
          findings,
          limitations,
        });
        return {
          auditId,
          status: "completed" as const,
          url: parsed.toString(),
          html: null,
          score: saved.score,
          issueCount: saved.issueCount,
          openIssueCount: saved.openIssueCount,
          limitations: saved.limitations,
          errorMessage: null,
        };
      }

      // Client path: leave audit running; UI runs axe and calls complete-audit.
      return {
        auditId,
        status: "awaiting_browser" as const,
        url: parsed.toString(),
        html,
        score: null,
        issueCount: 0,
        openIssueCount: 0,
        limitations,
        errorMessage: null,
      };
    } catch (error) {
      const message =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message.replace(
              /^Action \S+ failed:\s*/,
              "",
            )
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

      if (error && typeof error === "object" && "errorCode" in error) {
        throw error;
      }
      fail(message, { errorCode, statusCode });
    }
  },
});
