import type { AxeIssue } from "./axe-issue.js";

/**
 * Lightweight HTML checks that run on Cloudflare Workers (no jsdom / no axe).
 * Used when an agent (or API caller) needs results without a browser.
 * The Audits UI uses full axe-core in a sandboxed iframe instead.
 */
export function runReducedAuditOnHtml(html: string): AxeIssue[] {
  const issues: AxeIssue[] = [];
  const lower = html.toLowerCase();

  // html-has-lang
  const htmlTag = /<html\b[^>]*>/i.exec(html);
  if (htmlTag && !/\blang\s*=/i.test(htmlTag[0])) {
    issues.push({
      ruleId: "html-has-lang",
      impact: "serious",
      help: "html element must have a lang attribute",
      description:
        "The <html> element does not have a lang attribute, so screen readers may guess the wrong language.",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.14/html-has-lang",
      selector: "html",
      html: htmlTag[0].slice(0, 200),
      failureSummary: "Fix: add a lang attribute to the <html> element.",
    });
  }

  // document-title
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const titleText = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
  if (!titleMatch || !titleText) {
    issues.push({
      ruleId: "document-title",
      impact: "serious",
      help: "Documents must have a title element to aid navigation",
      description: "The document title is missing or empty.",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.14/document-title",
      selector: "title",
      html: titleMatch?.[0]?.slice(0, 200) ?? null,
      failureSummary: "Fix: add a non-empty <title> in <head>.",
    });
  }

  // image-alt
  const imgRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    if (/\brole\s*=\s*["']?presentation["']?/i.test(tag)) continue;
    if (/\baro-hidden\s*=\s*["']?true["']?/i.test(tag)) continue;
    if (/\balt\s*=/i.test(tag)) continue;
    issues.push({
      ruleId: "image-alt",
      impact: "critical",
      help: "Images must have alternate text",
      description: "An <img> element has no alt attribute.",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.14/image-alt",
      selector: "img",
      html: tag.slice(0, 500),
      failureSummary: "Fix: add an alt attribute that describes the image.",
    });
  }

  // button-name (empty <button>...</button>)
  const buttonRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  while ((m = buttonRe.exec(html)) !== null) {
    const attrs = m[1] ?? "";
    const inner = (m[2] ?? "").replace(/<[^>]+>/g, "").trim();
    const hasAria = /\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs);
    const hasTitle = /\btitle\s*=/i.test(attrs);
    if (!inner && !hasAria && !hasTitle) {
      issues.push({
        ruleId: "button-name",
        impact: "critical",
        help: "Buttons must have discernible text",
        description: "A <button> has no accessible name.",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.14/button-name",
        selector: "button",
        html: m[0].slice(0, 500),
        failureSummary: "Fix: put text content or aria-label on the button.",
      });
    }
  }

  // link-name (empty <a>...</a>)
  const linkRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const attrs = m[1] ?? "";
    const inner = (m[2] ?? "").replace(/<[^>]+>/g, "").trim();
    const hasAria = /\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs);
    const hasTitle = /\btitle\s*=/i.test(attrs);
    if (!inner && !hasAria && !hasTitle) {
      issues.push({
        ruleId: "link-name",
        impact: "serious",
        help: "Links must have discernible text",
        description: "An <a> element has no accessible name.",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.14/link-name",
        selector: "a",
        html: m[0].slice(0, 500),
        failureSummary: "Fix: put link text or aria-label on the anchor.",
      });
    }
  }

  void lower; // reserved for future checks
  return issues;
}
