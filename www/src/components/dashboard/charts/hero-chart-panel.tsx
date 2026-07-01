import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardCardHeader } from "@/components/dashboard/dashboard-card-header";
import { TotalPlayersChart } from "@/components/dashboard/charts/total-players-chart";
import { FadeInAnimation } from "@/components/motion/fade-in-animation";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type HeroChartPanelProps = {
  hasServers: boolean;
  window: MetricTimeWindow;
};

export function HeroChartPanel({ hasServers, window }: HeroChartPanelProps) {
  return (
    <FadeInAnimation>
      <DashboardCard className="hero-chart-panel">
        <DashboardCardHeader title="Total players" />
        <TotalPlayersChart
          hasServers={hasServers}
          window={window}
          height={360}
        />
      </DashboardCard>
    </FadeInAnimation>
  );
}
