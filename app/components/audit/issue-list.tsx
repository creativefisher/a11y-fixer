import { Link } from "react-router";

import { ImpactBadge } from "@/components/audit/impact-badge";
import { AUDIT_PATH } from "@/lib/chat-paths";
import { cn } from "@/lib/utils";

export type IssueRow = {
  id: string;
  ruleId: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  help: string;
  selector: string | null;
  status: "open" | "fixed" | "ignored";
  message: string;
};

export function IssueList({
  auditId,
  issues,
  selectedIssueId,
}: {
  auditId: string;
  issues: IssueRow[];
  selectedIssueId?: string | null;
}) {
  if (issues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No issues found for this filter. Nice work — or try another page.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {issues.map((issue) => {
        const active = issue.id === selectedIssueId;
        return (
          <li key={issue.id}>
            <Link
              to={`${AUDIT_PATH}/${auditId}?issue=${issue.id}`}
              className={cn(
                "flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-muted/70",
                issue.status === "fixed" && "opacity-60",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <ImpactBadge impact={issue.impact} />
                <span className="font-mono text-xs text-muted-foreground">
                  {issue.ruleId}
                </span>
                {issue.status !== "open" ? (
                  <span className="text-xs capitalize text-muted-foreground">
                    {issue.status}
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium">{issue.help}</p>
              {issue.selector ? (
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {issue.selector}
                </p>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
