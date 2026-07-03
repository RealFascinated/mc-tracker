import { AnimatedStatValue } from "@/components/dashboard/stats/animated-stat-value";
import { cn } from "cnfast";

type MetricStatProps = {
  label: string;
  value: number | null | undefined;
  className?: string;
  labelClassName?: string;
  highlight?: boolean;
  compact?: boolean;
  valueTooltip?: string;
};

export function MetricStat({
  label,
  value,
  className,
  labelClassName,
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
      <span className={cn("metric-stat-label", labelClassName)}>{label}</span>
      <AnimatedStatValue
        tooltip={valueTooltip}
        value={value}
        className="metric-stat-value"
      />
    </div>
  );
}
