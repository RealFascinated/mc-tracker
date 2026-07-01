import { useMemo } from "react";

import { LoadingState } from "@/components/loading-state";
import { ChartEmpty } from "@/components/metrics/chart-empty";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { useVisibleTimeseriesQuery } from "@/hooks/timeseries/use-visible-timeseries-query";
import {
  EMPTY_METRIC_TIME_SERIES,
  playersTimeseriesToMetric,
} from "@/lib/api/metric-timeseries";
import type { VisibleTimeseriesQueryOptions } from "@/lib/api/visible-timeseries-options";
import type { PlayersTimeseriesPayload } from "@/lib/api/types";
import type { ChartDefinition } from "@/lib/metrics/charts/types";
import {
  DASHBOARD_CHART_PROPS,
  DASHBOARD_CHART_EMPTY_MESSAGE,
  DASHBOARD_PLAYER_HISTORY_ERROR_MESSAGE,
} from "@/lib/metrics/dashboard-chart-constants";

type PlayersMetricChartProps = {
  def: ChartDefinition;
  timeseriesOptions: VisibleTimeseriesQueryOptions<PlayersTimeseriesPayload>;
  enabled?: boolean;
  height?: number;
  loadingMessage?: string;
};

export function PlayersMetricChart({
  def,
  timeseriesOptions,
  enabled = true,
  height = 360,
  loadingMessage = "Loading player history…",
}: PlayersMetricChartProps) {
  const { ref, isIntersecting, hasBeenVisible } = useIntersectionVisible();
  const { data, isPending, isError } = useVisibleTimeseriesQuery(
    timeseriesOptions,
    isIntersecting,
    enabled,
  );

  const chartData = useMemo(
    () => (data ? playersTimeseriesToMetric(data) : null),
    [data],
  );

  if (!hasBeenVisible && !data) {
    return <div ref={ref} style={{ height }} aria-hidden />;
  }

  if (isError) {
    return (
      <div ref={ref} className="w-full">
        <ChartEmpty
          message={DASHBOARD_PLAYER_HISTORY_ERROR_MESSAGE}
          height={height}
          className="text-sm text-destructive"
        />
      </div>
    );
  }

  const showLoading = isIntersecting && isPending && !data;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      <MetricChartView
        def={def}
        data={chartData ?? EMPTY_METRIC_TIME_SERIES}
        height={height}
        emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
        className="h-full"
        hydrateWhen={hasBeenVisible}
        {...DASHBOARD_CHART_PROPS}
      />
      {showLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
          <LoadingState message={loadingMessage} />
        </div>
      ) : null}
    </div>
  );
}
