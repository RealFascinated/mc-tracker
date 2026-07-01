import { AnimatedStatValue } from "@/components/dashboard/stats/animated-stat-value";
import { cn } from "@/lib/utils";

type MetricStatProps = {
  label: string;
  value: number | null | undefined;
  className?: string;
  highlight?: boolean;
  compact?: boolean;
  valueTooltip?: string;
};

export function MetricStat({
  label,
  value,
  className,
  highlight = false,
  compact = false,
  valueTooltip,
}: MetricStatProps) {
  return (
    <div
      className={cn(
        "metric-stat",
        highlight && "metric-stat-highlight",
        compact && "metric-stat-compact",
        className,
      )}
    >
      <span className="metric-stat-label">{label}</span>
      <AnimatedStatValue
        tooltip={valueTooltip}
        value={value}
        className="metric-stat-value"
      />
    </div>
  );
}
