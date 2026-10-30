/** Shared shapes for audit UI (plain data; no server imports). */
export type AuditStatus = "pending" | "running" | "completed" | "failed";
export type IssueStatus = "open" | "fixed" | "ignored";
export type ProposalStatus = "pending" | "accepted" | "rejected";
export type IssueImpact = "critical" | "serious" | "moderate" | "minor";
