import { useMemo } from "react";

import { LoadingState } from "@/components/loading-state";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { useVisibleTimeseriesQuery } from "@/hooks/timeseries/use-visible-timeseries-query";
import { EMPTY_METRIC_TIME_SERIES } from "@/lib/api/metric-timeseries";
import { serverTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { playersTimeseriesToMetric } from "@/lib/metrics/adapters";
import { createPlayersChart } from "@/lib/metrics/charts/players";
import {
  DASHBOARD_CHART_PROPS,
  DASHBOARD_CHART_EMPTY_MESSAGE,
} from "@/lib/metrics/dashboard-chart-constants";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type ServerPlayersChartProps = {
  serverId: string;
  window: MetricTimeWindow;
  height?: number;
};

export function ServerPlayersChart({
  serverId,
  window,
  height = 360,
}: ServerPlayersChartProps) {
  const { ref, isIntersecting, hasBeenVisible } = useIntersectionVisible();
  const chartDef = useMemo(
    () => createPlayersChart(`server-players-${serverId}`),
    [serverId],
  );
  const timeseriesOptions = useMemo(() => {
    const { queryKey, queryFn } = serverTimeseriesQueryOptions(serverId, window);
    return toVisibleTimeseriesOptions({ queryKey, queryFn });
  }, [serverId, window]);
  const { data, isPending, isError } = useVisibleTimeseriesQuery(
    timeseriesOptions,
    isIntersecting,
    serverId.length > 0,
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
      <div ref={ref} className="flex items-center px-4" style={{ height }}>
        <p className="text-sm text-destructive">
          Failed to load player history.
        </p>
      </div>
    );
  }

  const showLoading = isIntersecting && isPending && !data;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      <MetricChartView
        def={chartDef}
        data={chartData ?? EMPTY_METRIC_TIME_SERIES}
        height={height}
        emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
        className="h-full"
        hydrateWhen={hasBeenVisible}
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
