/** Honest limits of the HTML-fetch + jsdom audit path. */
export const AUDIT_LIMITATIONS = [
  "Color contrast is not checked: jsdom cannot compute real styles.",
  "Only the initial HTML is audited; client-rendered content may be missed.",
  "Pages that block bots or require login cannot be fetched.",
].join(" ");

export const MAX_HTML_BYTES = 1_500_000;
export const FETCH_TIMEOUT_MS = 15_000;
