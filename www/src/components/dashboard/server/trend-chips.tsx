import { cn } from "cnfast";

import { formatPercentValue } from "@/lib/formatter";

type TrendTone = "positive" | "negative" | "neutral";

function trendTone(value: number): TrendTone {
  if (Math.abs(value) < 0.05) {
    return "neutral";
  }
  return value > 0 ? "positive" : "negative";
}

function TrendChip({ label, value }: { label: string; value?: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  const tone = trendTone(value);

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 rounded-snug border px-1.5 py-0.5",
        tone === "neutral" && "border-border bg-muted/30 text-muted-foreground",
        tone === "positive" &&
          "border-green-600/25 bg-green-600/5 text-green-600 dark:border-green-400/25 dark:bg-green-400/5 dark:text-green-400",
        tone === "negative" &&
          "border-red-600/25 bg-red-600/5 text-red-600 dark:border-red-400/25 dark:bg-red-400/5 dark:text-red-400",
      )}
    >
      <span className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-mono text-[11px] font-semibold tabular-nums">
        {tone === "positive" ? "+" : ""}
        {formatPercentValue(value, 1)}
      </span>
    </span>
  );
}

type ServerTrendChipsProps = {
  trend30d?: number | null;
  className?: string;
};

export function ServerTrendChips({
  trend30d,
  className,
}: ServerTrendChipsProps) {
  const has30d = trend30d != null && Number.isFinite(trend30d);

  if (!has30d) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-label="Player trend">
      <TrendChip label="30d" value={trend30d} />
    </div>
  );
}
