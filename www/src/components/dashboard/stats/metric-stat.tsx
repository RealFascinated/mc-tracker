import { cn } from "@/lib/utils";
import { StatValueTooltip } from "@/components/dashboard/stats/stat-value-tooltip";

type MetricStatProps = {
  label: string;
  value: string;
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
      <StatValueTooltip
        tooltip={valueTooltip}
        value={value}
        className="metric-stat-value"
      />
    </div>
  );
}
