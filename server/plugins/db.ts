import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "a11y-audits-issues-proposals",
      sql: `
        CREATE TABLE IF NOT EXISTS audits (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          score INTEGER,
          issue_count INTEGER NOT NULL DEFAULT 0,
          open_issue_count INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          limitations TEXT,
          owner_email TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS audits_owner_created_idx
          ON audits (owner_email, created_at DESC);

        CREATE TABLE IF NOT EXISTS issues (
          id TEXT PRIMARY KEY,
          audit_id TEXT NOT NULL,
          rule_id TEXT NOT NULL,
          impact TEXT NOT NULL DEFAULT 'moderate',
          help TEXT NOT NULL,
          description TEXT NOT NULL,
          help_url TEXT,
          selector TEXT,
          html TEXT,
          failure_summary TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          owner_email TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS issues_audit_idx ON issues (audit_id);
        CREATE INDEX IF NOT EXISTS issues_audit_status_idx ON issues (audit_id, status);

        CREATE TABLE IF NOT EXISTS proposals (
          id TEXT PRIMARY KEY,
          issue_id TEXT NOT NULL,
          audit_id TEXT NOT NULL,
          before_html TEXT NOT NULL,
          after_html TEXT NOT NULL,
          rationale TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'heuristic',
          status TEXT NOT NULL DEFAULT 'pending',
          reject_reason TEXT,
          owner_email TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          decided_at TEXT
        );
        CREATE INDEX IF NOT EXISTS proposals_issue_idx ON proposals (issue_id);
        CREATE INDEX IF NOT EXISTS proposals_audit_idx ON proposals (audit_id);
      `,
    },
  ],
  { table: "a11y_fixer_migrations" },
);
