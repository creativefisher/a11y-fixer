/**
 * Server-side axe-in-jsdom was removed for Cloudflare Workers compatibility
 * (node:vm / jsdom are not reliable on Workers).
 *
 * - UI: `app/lib/run-axe-in-browser.ts` (full axe, including color-contrast)
 * - Agent / no-browser: `server/lib/reduced-audit.ts`
 */
export type { AxeIssue } from "./axe-issue.js";
export { normalizeImpact } from "./axe-issue.js";
export { runReducedAuditOnHtml as runAxeOnHtml } from "./reduced-audit.js";
