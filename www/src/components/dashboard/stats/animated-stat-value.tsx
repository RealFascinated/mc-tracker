import { StatValueTooltip } from "@/components/dashboard/stats/stat-value-tooltip";
import { useCountUp } from "@/hooks/use-count-up";
import { formatPlayers } from "@/lib/formatter";

type AnimatedStatValueProps = {
  value: number | null | undefined;
  tooltip?: string;
  className?: string;
};

export function AnimatedStatValue({
  value,
  tooltip,
  className,
}: AnimatedStatValueProps) {
  const animated = useCountUp(value);

  return (
    <StatValueTooltip
      tooltip={tooltip}
      value={formatPlayers(animated)}
      className={className}
    />
  );
}
