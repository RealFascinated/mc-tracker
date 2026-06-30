import { useMemo } from "react";

import { LoadingState } from "@/components/loading-state";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import { useVisibleTotalTimeseriesQuery } from "@/hooks/timeseries/use-visible-timeseries-query";
import { EMPTY_METRIC_TIME_SERIES } from "@/lib/api/metric-timeseries";
import { playersTimeseriesToMetric } from "@/lib/metrics/adapters";
import { totalPlayersChart } from "@/lib/metrics/charts/players";
import {
  DASHBOARD_CHART_PROPS,
  DASHBOARD_CHART_EMPTY_MESSAGE,
} from "@/lib/metrics/dashboard-chart-constants";
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
  const { ref, isVisible, data, isPending, isError } =
    useVisibleTotalTimeseriesQuery(window);

  const chartData = useMemo(
    () => (data ? playersTimeseriesToMetric(data) : null),
    [data],
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

  if (!isVisible && !data) {
    return <div ref={ref} style={{ height }} aria-hidden />;
  }

  const showLoading = isVisible && isPending && !data;

  if (showLoading) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center"
        style={{ height }}
      >
        <LoadingState message="Loading player history…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div ref={ref}>
        <p className="px-4 py-8 text-sm text-destructive">
          Failed to load player history.
        </p>
      </div>
    );
  }

  return (
    <div ref={ref}>
      <MetricChartView
        def={totalPlayersChart}
        data={chartData ?? EMPTY_METRIC_TIME_SERIES}
        height={height}
        emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
        {...DASHBOARD_CHART_PROPS}
      />
    </div>
  );
}
