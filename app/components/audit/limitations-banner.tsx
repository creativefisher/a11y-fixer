export function LimitationsBanner({ text }: { text?: string | null | undefined }) {
  const message =
    text?.trim() ||
    "Color contrast is not checked: jsdom cannot compute real styles. Only the initial HTML is audited.";
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
