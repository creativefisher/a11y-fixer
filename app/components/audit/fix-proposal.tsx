import { ConnectBuilderBanner } from "@/components/audit/connect-builder-banner";
import { Button } from "@/components/ui/button";

export type ProposalView = {
  id: string;
  beforeHtml: string;
  afterHtml: string;
  rationale: string;
  source: "heuristic" | "agent" | "mock";
  status: "pending" | "accepted" | "rejected";
};

export function FixProposalPanel({
  proposal,
  needsBuilderMessage,
  isProposing,
  isDeciding,
  onPropose,
  onAccept,
  onReject,
}: {
  proposal: ProposalView | null;
  needsBuilderMessage?: string | null;
  isProposing?: boolean;
  isDeciding?: boolean;
  onPropose: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  if (needsBuilderMessage) {
    return <ConnectBuilderBanner message={needsBuilderMessage} />;
  }

  if (!proposal) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No proposal yet. Generate a free heuristic fix (or a mock when{" "}
          <code className="text-xs">A11Y_MOCK_LLM</code> is on). Builder credits
          are only used when heuristics cannot cover the rule.
        </p>
        <Button onClick={onPropose} disabled={isProposing}>
          {isProposing ? "Proposing…" : "Propose fix"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 capitalize">
          {proposal.source}
        </span>
        <span className="capitalize">{proposal.status}</span>
      </div>
      <p className="text-sm">{proposal.rationale}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Before
          </p>
          <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
            {proposal.beforeHtml}
          </pre>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            After
          </p>
          <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
            {proposal.afterHtml}
          </pre>
        </div>
      </div>
      {proposal.status === "pending" ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onAccept} disabled={isDeciding}>
            Accept
          </Button>
          <Button variant="outline" onClick={onReject} disabled={isDeciding}>
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  );
}
