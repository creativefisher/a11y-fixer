import { Link } from "react-router";

import { Button } from "@/components/ui/button";

/** Shown when propose-fix returns needs_builder (no heuristic, no mock). */
export function ConnectBuilderBanner({ message }: { message?: string }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
    >
      <p className="font-medium">Connect Builder.io to generate fixes</p>
      <p className="mt-1 text-muted-foreground">
        {message ||
          "This issue has no free heuristic fix. Connect Builder.io free credits (Use Builder.io) so the agent can draft one. Common fixes still work offline."}
      </p>
      <div className="mt-3">
        <Button asChild variant="outline" size="sm">
          <Link to="/settings/agent">Open AI settings</Link>
        </Button>
      </div>
    </div>
  );
}
