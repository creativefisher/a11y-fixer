export function LimitationsBanner({ text }: { text?: string | null | undefined }) {
  const message =
    text?.trim() ||
    "Axe runs in your browser on a sandboxed HTML snapshot (page scripts disabled). Only the initial server-fetched HTML is audited.";
  return (
    <div
      role="note"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p className="font-medium">Audit limits</p>
      <p className="mt-1 opacity-90">{message}</p>
    </div>
  );
}
