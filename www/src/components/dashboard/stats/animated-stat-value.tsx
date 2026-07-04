import { StatValueTooltip } from "@/components/dashboard/stats/stat-value-tooltip";
import { useCountUp } from "@/hooks/use-count-up";
import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { formatPlayers } from "@/lib/formatter";

type AnimatedStatValueProps = {
  value: number | null | undefined;
  tooltip?: string;
  className?: string;
  active?: boolean;
};

function AnimatedStatValueCore({
  value,
  tooltip,
  className,
  active,
}: AnimatedStatValueProps & { active: boolean }) {
  const animated = useCountUp(value, undefined, active);

  return (
    <StatValueTooltip
      tooltip={tooltip}
      value={formatPlayers(animated)}
      className={className}
    />
  );
}

function AnimatedStatValueObserved({
  value,
  tooltip,
  className,
}: Omit<AnimatedStatValueProps, "active">) {
  const { ref, hasBeenVisible } = useIntersectionVisible();

  return (
    <span ref={ref}>
      <AnimatedStatValueCore
        value={value}
        tooltip={tooltip}
        className={className}
        active={hasBeenVisible}
      />
    </span>
  );
}

export function AnimatedStatValue({
  active: activeProp,
  ...props
}: AnimatedStatValueProps) {
  if (activeProp !== undefined) {
    return <AnimatedStatValueCore {...props} active={activeProp} />;
  }

  return <AnimatedStatValueObserved {...props} />;
}
