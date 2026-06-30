import {
  DashboardCard,
  DashboardCardHeader,
  DashboardRangeToggle,
} from "@/components/dashboard/dashboard-card";
import { TotalPlayersChart } from "@/components/dashboard/charts/total-players-chart";
import { METRIC_RANGE_OPTIONS } from "@/lib/metrics/range";
import type { MetricTimeRange } from "@/lib/metrics/range";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type HeroChartPanelProps = {
  hasServers: boolean;
  window: MetricTimeWindow;
  timeRange: MetricTimeRange;
  onTimeRangeChange: (range: MetricTimeRange) => void;
};

export function HeroChartPanel({
  hasServers,
  window,
  timeRange,
  onTimeRangeChange,
}: HeroChartPanelProps) {
  return (
    <DashboardCard className="hero-chart-panel motion-chart-reveal">
      <DashboardCardHeader
        title="Total players"
        trailingAction={
          <DashboardRangeToggle
            value={timeRange}
            options={METRIC_RANGE_OPTIONS}
            onValueChange={onTimeRangeChange}
            aria-label="Chart time range"
          />
        }
      />
      <TotalPlayersChart hasServers={hasServers} window={window} height={360} />
    </DashboardCard>
  );
}
