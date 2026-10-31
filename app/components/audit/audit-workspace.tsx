import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { FixProposalPanel } from "@/components/audit/fix-proposal";
import { IssueList } from "@/components/audit/issue-list";
import { LimitationsBanner } from "@/components/audit/limitations-banner";
import { UrlForm } from "@/components/audit/url-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { runAxeInBrowser } from "@/lib/run-axe-in-browser";
import { AUDIT_PATH } from "@/lib/chat-paths";

type Severity = "critical" | "serious" | "moderate" | "minor";

export function AuditLanding() {
  useSetPageTitle("Accessibility audits");
  const navigate = useNavigate();
  const startAudit = useActionMutation("start-audit");
  const completeAudit = useActionMutation("complete-audit");
  const [isRunningBrowserAxe, setIsRunningBrowserAxe] = useState(false);
  const auditsQuery = useActionQuery("list-audits", { limit: 20 });
  const auditBusy = startAudit.isPending || completeAudit.isPending || isRunningBrowserAxe;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Accessibility Fixer
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Paste a public URL. The server fetches HTML (SSRF-safe); axe-core runs
          in your browser inside a sandboxed iframe (scripts off, color-contrast
          on). Then propose free heuristic fixes — Builder.io free credits cover
          rules heuristics cannot.
        </p>
      </header>

      <LimitationsBanner />

      <Card>
        <CardHeader>
          <CardTitle>New audit</CardTitle>
          <CardDescription>
            Works on public pages. Full axe (incl. color contrast) runs in this
            browser. Agents without a browser can call start-audit with
            execution=&quot;server&quot; for a reduced check.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UrlForm
            isPending={auditBusy}
            onSubmit={(url) => {
              startAudit.mutate(
                { url, execution: "client" },
                {
                  onSuccess: (result) => {
                    if (result.status === "completed") {
                      toast.success(
                        `Audit done — ${result.issueCount} issue(s), score ${result.score}`,
                      );
                      navigate(`${AUDIT_PATH}/${result.auditId}`);
                      return;
                    }
                    if (result.status !== "awaiting_browser" || !result.html) {
                      toast.error(result.errorMessage || "Audit did not return HTML");
                      return;
                    }
                    setIsRunningBrowserAxe(true);
                    void (async () => {
                      try {
                        const findings = await runAxeInBrowser(
                          result.html!,
                          result.url,
                        );
                        completeAudit.mutate(
                          { auditId: result.auditId, issues: findings },
                          {
                            onSuccess: (saved) => {
                              toast.success(
                                `Audit done — ${saved.issueCount} issue(s), score ${saved.score}`,
                              );
                              navigate(`${AUDIT_PATH}/${saved.auditId}`);
                            },
                            onError: (error) => {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Saving audit failed",
                              );
                            },
                            onSettled: () => setIsRunningBrowserAxe(false),
                          },
                        );
                      } catch (error) {
                        setIsRunningBrowserAxe(false);
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Browser axe failed",
                        );
                      }
                    })();
                  },
                  onError: (error) => {
                    toast.error(
                      error instanceof Error ? error.message : "Audit failed",
                    );
                  },
                },
              );
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent audits</CardTitle>
        </CardHeader>
        <CardContent>
          {auditsQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (auditsQuery.data?.audits.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No audits yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {auditsQuery.data?.audits.map((audit) => (
                <li key={audit.id}>
                  <Link
                    to={`${AUDIT_PATH}/${audit.id}`}
                    className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{audit.url}</p>
                      <p className="text-xs text-muted-foreground">
                        {audit.status}
                        {audit.score != null ? ` · score ${audit.score}` : ""}
                        {` · ${audit.openIssueCount}/${audit.issueCount} open`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(audit.createdAt).toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AuditDetail({ auditId }: { auditId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIssueId = searchParams.get("issue");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [needsBuilderMessage, setNeedsBuilderMessage] = useState<string | null>(
    null,
  );

  const auditQuery = useActionQuery("get-audit", { auditId });
  const issuesQuery = useActionQuery("list-issues", {
    auditId,
    ...(severity === "all" ? {} : { severity }),
  });
  const issueQuery = useActionQuery(
    "get-issue",
    { issueId: selectedIssueId ?? "" },
    { enabled: Boolean(selectedIssueId) },
  );

  useSetPageTitle(
    auditQuery.data?.url
      ? `Audit · ${auditQuery.data.url}`
      : "Accessibility audit",
  );

  const proposeFix = useActionMutation("propose-fix");
  const acceptFix = useActionMutation("accept-fix");
  const rejectFix = useActionMutation("reject-fix");

  const selected = issueQuery.data ?? null;

  const severityFilters = useMemo(
    () => ["all", "critical", "serious", "moderate", "minor"] as const,
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            to={AUDIT_PATH}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← All audits
          </Link>
          <h1 className="text-xl font-semibold tracking-tight break-all">
            {auditQuery.data?.url ?? "Loading audit…"}
          </h1>
          {auditQuery.data ? (
            <p className="text-sm text-muted-foreground">
              {auditQuery.data.status}
              {auditQuery.data.score != null
                ? ` · score ${auditQuery.data.score}`
                : ""}
              {` · ${auditQuery.data.openIssueCount} open of ${auditQuery.data.issueCount}`}
            </p>
          ) : null}
        </div>
      </div>

      <LimitationsBanner text={auditQuery.data?.limitations} />

      {auditQuery.data?.status === "failed" ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {auditQuery.data.errorMessage || "Audit failed."}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Issues</CardTitle>
            <div className="flex flex-wrap gap-2">
              {severityFilters.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={severity === value ? "default" : "outline"}
                  className="capitalize"
                  onClick={() => setSeverity(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {issuesQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading issues…</p>
            ) : (
              <IssueList
                auditId={auditId}
                issues={issuesQuery.data?.issues ?? []}
                selectedIssueId={selectedIssueId}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fix proposal</CardTitle>
            <CardDescription>
              {selected
                ? `${selected.ruleId} · ${selected.help}`
                : "Select an issue to propose a fix."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedIssueId ? (
              <p className="text-sm text-muted-foreground">
                Choose an issue from the list.
              </p>
            ) : issueQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading issue…</p>
            ) : selected ? (
              <>
                {selected.selector ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    {selected.selector}
                  </p>
                ) : null}
                {selected.html ? (
                  <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                    {selected.html}
                  </pre>
                ) : null}
                <FixProposalPanel
                  proposal={selected.latestProposal}
                  needsBuilderMessage={needsBuilderMessage}
                  isProposing={proposeFix.isPending}
                  isDeciding={acceptFix.isPending || rejectFix.isPending}
                  onPropose={() => {
                    setNeedsBuilderMessage(null);
                    proposeFix.mutate(
                      { issueId: selected.id },
                      {
                        onSuccess: (result) => {
                          if (result.status === "needs_builder") {
                            setNeedsBuilderMessage(result.message);
                            return;
                          }
                          setNeedsBuilderMessage(null);
                          toast.success(result.message);
                          void issueQuery.refetch();
                        },
                        onError: (error) => {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Propose failed",
                          );
                        },
                      },
                    );
                  }}
                  onAccept={() => {
                    const proposalId = selected.latestProposal?.id;
                    if (!proposalId) return;
                    acceptFix.mutate(
                      { proposalId },
                      {
                        onSuccess: () => {
                          toast.success("Fix accepted");
                          void issueQuery.refetch();
                          void issuesQuery.refetch();
                          void auditQuery.refetch();
                        },
                        onError: (error) => {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Accept failed",
                          );
                        },
                      },
                    );
                  }}
                  onReject={() => {
                    const proposalId = selected.latestProposal?.id;
                    if (!proposalId) return;
                    rejectFix.mutate(
                      { proposalId, reason: "Not the right fix" },
                      {
                        onSuccess: () => {
                          toast.message("Proposal rejected");
                          void issueQuery.refetch();
                        },
                        onError: (error) => {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Reject failed",
                          );
                        },
                      },
                    );
                  }}
                />
                {!selected.latestProposal && !needsBuilderMessage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSearchParams({}, { replace: true })
                    }
                  >
                    Clear selection
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Issue not found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
