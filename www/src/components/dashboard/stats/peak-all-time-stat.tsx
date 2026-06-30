import { MetricStat } from "@/components/dashboard/stats/metric-stat";
import { formatPlayers } from "@/lib/format-players";
import { peakAllTimeTooltip } from "@/lib/format-peak-at";
import type { PeakPlayers } from "@/lib/api/types";

type PeakAllTimeStatProps = {
  peak: PeakPlayers | null;
  className?: string;
  compact?: boolean;
};

export function PeakAllTimeStat({
  peak,
  className,
  compact = false,
}: PeakAllTimeStatProps) {
  return (
    <MetricStat
      label="Peak all-time"
      value={formatPlayers(peak?.players ?? null)}
      valueTooltip={peakAllTimeTooltip(peak)}
      className={className}
      compact={compact}
    />
  );
}
