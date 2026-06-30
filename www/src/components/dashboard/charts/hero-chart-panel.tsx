import {
  DashboardCard,
  DashboardCardHeader,
} from "@/components/dashboard/dashboard-card";
import { TotalPlayersChart } from "@/components/dashboard/charts/total-players-chart";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type HeroChartPanelProps = {
  hasServers: boolean;
  window: MetricTimeWindow;
};

export function HeroChartPanel({ hasServers, window }: HeroChartPanelProps) {
  return (
    <DashboardCard className="hero-chart-panel motion-chart-reveal">
      <DashboardCardHeader title="Total players" />
      <TotalPlayersChart hasServers={hasServers} window={window} height={360} />
    </DashboardCard>
  );
}
