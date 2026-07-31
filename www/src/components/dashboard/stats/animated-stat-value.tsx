import { StatValueTooltip } from "@/components/dashboard/stats/stat-value-tooltip";
import { useCountUp } from "@/hooks/use-count-up";
import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { formatPlayers } from "@/lib/formatter";

type AnimatedStatValueProps = {
  value: number | null | undefined;
  tooltip?: string;
  className?: string;
  active?: boolean;
  delay?: number;
};

function AnimatedStatValueCore({
  value,
  tooltip,
  className,
  active,
  delay = 0,
}: AnimatedStatValueProps & { active: boolean }) {
  const animated = useCountUp(value, undefined, active, delay);

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
  delay = 0,
}: Omit<AnimatedStatValueProps, "active">) {
  const { ref, hasBeenVisible } = useIntersectionVisible();

  return (
    <span ref={ref}>
      <AnimatedStatValueCore
        value={value}
        tooltip={tooltip}
        className={className}
        active={hasBeenVisible}
        delay={delay}
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
