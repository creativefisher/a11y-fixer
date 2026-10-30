import { sql } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";

/** One accessibility audit of a URL. */
export const audits = pgTable("audits", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  score: integer("score"),
  issueCount: integer("issue_count").notNull().default(0),
  openIssueCount: integer("open_issue_count").notNull().default(0),
  errorMessage: text("error_message"),
  limitations: text("limitations"),
  ownerEmail: text("owner_email").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  completedAt: text("completed_at"),
});

/** One axe-core violation node (one issue the user can fix). */
export const issues = pgTable("issues", {
  id: text("id").primaryKey(),
  auditId: text("audit_id").notNull(),
  ruleId: text("rule_id").notNull(),
  impact: text("impact", {
    enum: ["critical", "serious", "moderate", "minor"],
  })
    .notNull()
    .default("moderate"),
  help: text("help").notNull(),
  description: text("description").notNull(),
  helpUrl: text("help_url"),
  selector: text("selector"),
  html: text("html"),
  failureSummary: text("failure_summary"),
  status: text("status", {
    enum: ["open", "fixed", "ignored"],
  })
    .notNull()
    .default("open"),
  ownerEmail: text("owner_email").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

/** A proposed before/after code fix for an issue. */
export const proposals = pgTable("proposals", {
  id: text("id").primaryKey(),
  issueId: text("issue_id").notNull(),
  auditId: text("audit_id").notNull(),
  beforeHtml: text("before_html").notNull(),
  afterHtml: text("after_html").notNull(),
  rationale: text("rationale").notNull(),
  source: text("source", {
    enum: ["heuristic", "agent", "mock"],
  })
    .notNull()
    .default("heuristic"),
  status: text("status", {
    enum: ["pending", "accepted", "rejected"],
  })
    .notNull()
    .default("pending"),
  rejectReason: text("reject_reason"),
  ownerEmail: text("owner_email").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  decidedAt: text("decided_at"),
});
