import { useMemo } from "react";

import { PlayersMetricChart } from "@/components/dashboard/charts/players-metric-chart";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import { EMPTY_METRIC_TIME_SERIES } from "@/lib/api/metric-timeseries";
import { totalTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { totalPlayersChart } from "@/lib/metrics/charts/players";
import { DASHBOARD_CHART_PROPS } from "@/lib/metrics/dashboard-chart-constants";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type TotalPlayersChartProps = {
  hasServers: boolean;
  window: MetricTimeWindow;
  height?: number;
};

export function TotalPlayersChart({
  hasServers,
  window,
  height = 300,
}: TotalPlayersChartProps) {
  const timeseriesOptions = useMemo(
    () => toVisibleTimeseriesOptions(totalTimeseriesQueryOptions(window)),
    [window],
  );

  if (!hasServers) {
    return (
      <MetricChartView
        def={totalPlayersChart}
        data={EMPTY_METRIC_TIME_SERIES}
        emptyMessage="No servers configured."
        height={height}
        {...DASHBOARD_CHART_PROPS}
      />
    );
  }

  return (
    <PlayersMetricChart
      def={totalPlayersChart}
      timeseriesOptions={timeseriesOptions}
      height={height}
    />
  );
}
