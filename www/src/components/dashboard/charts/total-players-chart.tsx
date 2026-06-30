import { useMemo } from "react";

import { LoadingState } from "@/components/loading-state";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { useVisibleTimeseriesQuery } from "@/hooks/timeseries/use-visible-timeseries-query";
import { EMPTY_METRIC_TIME_SERIES } from "@/lib/api/metric-timeseries";
import { totalTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
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
  const { ref, isVisible } = useIntersectionVisible();
  const timeseriesOptions = useMemo(
    () => toVisibleTimeseriesOptions(totalTimeseriesQueryOptions(window)),
    [window],
  );
  const { data, isPending, isError } = useVisibleTimeseriesQuery(
    timeseriesOptions,
    isVisible,
  );

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

  if (isError) {
    return (
      <div
        ref={ref}
        className="flex items-center px-4"
        style={{ height }}
      >
        <p className="text-sm text-destructive">
          Failed to load player history.
        </p>
      </div>
    );
  }

  const showLoading = isVisible && isPending && !data;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      <MetricChartView
        def={totalPlayersChart}
        data={chartData ?? EMPTY_METRIC_TIME_SERIES}
        height={height}
        emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
        className="h-full"
        hydrateWhen={isVisible}
        {...DASHBOARD_CHART_PROPS}
      />
      {showLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
          <LoadingState message="Loading player history…" />
        </div>
      ) : null}
    </div>
  );
}
