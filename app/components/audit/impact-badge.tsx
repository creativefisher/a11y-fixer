import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  serious: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  moderate: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  minor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export function ImpactBadge({ impact }: { impact: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[impact] ?? STYLES.moderate,
      )}
    >
      {impact}
    </span>
  );
}
