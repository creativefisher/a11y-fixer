/** Limits for the browser axe path (UI / complete-audit after client run). */
export const AUDIT_LIMITATIONS_BROWSER = [
  "Axe runs in your browser against a sandboxed snapshot of the fetched HTML (scripts disabled).",
  "Only the initial HTML response is audited; heavy client-rendered apps may be incomplete.",
  "Pages that block bots or require login cannot be fetched by the server.",
].join(" ");

/**
 * Limits for the reduced server-side fallback (agents / no browser).
 * No jsdom — Cloudflare Workers cannot run it reliably.
 */
export const AUDIT_LIMITATIONS_SERVER = [
  "Reduced server audit (no jsdom): checks image-alt, html lang, empty buttons/links, and missing document title only.",
  "Color contrast and most axe rules are skipped on the server path — open the Audits UI for a full browser axe run.",
  "Only the initial HTML is audited; pages that block bots cannot be fetched.",
].join(" ");

/** @deprecated Prefer AUDIT_LIMITATIONS_BROWSER or _SERVER. */
export const AUDIT_LIMITATIONS = AUDIT_LIMITATIONS_BROWSER;

export const MAX_HTML_BYTES = 1_500_000;
export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_ISSUES_PER_AUDIT = 500;
