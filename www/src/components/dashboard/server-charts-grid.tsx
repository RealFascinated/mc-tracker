import { useMemo } from "react";

import {
  DashboardCard,
  DashboardCardHeader,
} from "@/components/dashboard/dashboard-card";
import { LoadingState } from "@/components/loading-state";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import type { ServerListItem } from "@/lib/api/servers";
import { serverTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { serverTimeseriesToMetric } from "@/lib/metrics/adapters";
import { serverPlayersChart } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { useQuery } from "@tanstack/react-query";

const EMPTY_CHART_DATA = {
  from: 0,
  to: 0,
  step: null,
  timestamps: [] as number[],
  series: {} as Record<string, Array<number | null>>,
};

type ServerPlayersChartCardProps = {
  server: ServerListItem;
  window: MetricTimeWindow;
};

function ServerPlayersChartCard({
  server,
  window,
}: ServerPlayersChartCardProps) {
  const chartDef = useMemo(() => serverPlayersChart(server.id), [server.id]);
  const { data, isPending, isError } = useQuery(
    serverTimeseriesQueryOptions(server.id, window),
  );

  const chartData = useMemo(
    () => (data ? serverTimeseriesToMetric(data) : EMPTY_CHART_DATA),
    [data],
  );

  return (
    <DashboardCard className="h-full">
      <DashboardCardHeader title={server.name} />
      {isPending ? (
        <LoadingState message="Loading…" className="h-[220px]" />
      ) : isError ? (
        <p className="px-4 py-8 text-sm text-destructive">
          Failed to load history.
        </p>
      ) : (
        <MetricChartView
          def={chartDef}
          data={chartData}
          height={220}
          hideHeader
          showCurrentValues={false}
          emptyMessage="No player history yet."
        />
      )}
    </DashboardCard>
  );
}

type ServerChartsGridProps = {
  servers: ServerListItem[];
  window: MetricTimeWindow;
};

export function ServerChartsGrid({ servers, window }: ServerChartsGridProps) {
  if (servers.length === 0) {
    return null;
  }

  return (
    <div className="metric-chart-grid-container">
      <div className="metric-chart-grid">
        {servers.map((server) => (
          <ServerPlayersChartCard
            key={server.id}
            server={server}
            window={window}
          />
        ))}
      </div>
    </div>
  );
}
