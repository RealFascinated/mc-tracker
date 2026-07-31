import { useMemo } from "react";

import { PlayersMetricChart } from "@/components/dashboard/charts/players-metric-chart";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import { EMPTY_METRIC_TIME_SERIES, timeseriesToMetric } from "@/lib/api/metric-timeseries";
import type { MetricTimeSeries } from "@/lib/api/metric-timeseries";
import { perServerTimeseriesQueryOptions, totalTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import type { PerServerTimeseriesItem, PerServerTimeseriesResponse } from "@/lib/api/servers";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import type { VisibleTimeseriesQueryOptions } from "@/lib/api/visible-timeseries-options";
import { totalPlayersChart } from "@/lib/metrics/charts/players";
import type { ChartDefinition } from "@/lib/metrics/charts/types";
import { DASHBOARD_CHART_PROPS } from "@/lib/metrics/dashboard-chart-constants";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { useVisibleTimeseriesQuery } from "@/hooks/timeseries/use-visible-timeseries-query";
import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { LoadingState } from "@/components/loading-state";
import { ChartEmpty } from "@/components/metrics/chart-empty";
import {
  DASHBOARD_CHART_EMPTY_MESSAGE,
  DASHBOARD_PLAYER_HISTORY_ERROR_MESSAGE,
} from "@/lib/metrics/dashboard-chart-constants";

type TotalPlayersChartProps = {
  hasServers: boolean;
  window: MetricTimeWindow;
  height?: number;
  showAnnotations?: boolean;
  mode?: "overall" | "servers";
};

function buildPerServerChartDefinition(
  servers: PerServerTimeseriesItem[],
): ChartDefinition {
  return {
    id: "total-players-per-server",
    title: "Total players",
    series: servers.map((server) => ({
      key: `server_${server.id}`,
      label: server.name,
      unit: "count" as const,
      axis: "left",
      fill: true,
    })),
    axes: {
      left: { unit: "count" as const, yRange: "autoMin" as const },
    },
  };
}

function perServerToMetricTimeSeries(
  response: { from: number; to: number; servers: PerServerTimeseriesItem[] },
): MetricTimeSeries {
  if (response.servers.length === 0) return EMPTY_METRIC_TIME_SERIES;

  const allTimestamps = new Set<number>();
  const serverLanes: Array<{ key: string; timestamps: number[]; values: Array<number | null> }> = [];

  for (const server of response.servers) {
    const metric = timeseriesToMetric(server);
    const lane = metric.series.players_online;
    if (!lane) continue;
    const ts = metric.timestamps;
    for (const t of ts) allTimestamps.add(t);
    serverLanes.push({ key: `server_${server.id}`, timestamps: ts, values: lane });
  }

  const timestamps = [...allTimestamps].sort((a, b) => a - b);
  const series: Record<string, Array<number | null>> = {};

  for (const lane of serverLanes) {
    const valueMap = new Map(lane.timestamps.map((t, i) => [t, lane.values[i]]));
    series[lane.key] = timestamps.map((t) => valueMap.get(t) ?? null);
  }

  return { from: response.from, to: response.to, step: null, timestamps, series };
}

export function TotalPlayersChart({
  hasServers,
  window,
  height = 300,
  showAnnotations = false,
  mode = "overall",
}: TotalPlayersChartProps) {
  const timeseriesOptions = useMemo(
    () => toVisibleTimeseriesOptions(totalTimeseriesQueryOptions(window)),
    [window],
  );

  const perServerOptions = useMemo(
    () => toVisibleTimeseriesOptions(perServerTimeseriesQueryOptions(window)) as VisibleTimeseriesQueryOptions<PerServerTimeseriesResponse>,
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

  if (mode === "servers") {
    return <PerServerChart
      timeseriesOptions={perServerOptions}
      height={height}
    />;
  }

  return (
    <PlayersMetricChart
      def={totalPlayersChart}
      timeseriesOptions={timeseriesOptions}
      height={height}
      showAnnotations={showAnnotations}
    />
  );
}

type PerServerChartProps = {
  timeseriesOptions: VisibleTimeseriesQueryOptions<PerServerTimeseriesResponse>;
  height: number;
};

function PerServerChart({ timeseriesOptions, height }: PerServerChartProps) {
  const { ref, isIntersecting, hasBeenVisible } = useIntersectionVisible();
  const { data, isPending, isError } = useVisibleTimeseriesQuery<PerServerTimeseriesResponse>(
    timeseriesOptions,
    isIntersecting,
    true,
  );

  const chartData = useMemo(() => {
    if (!data) return null;
    return perServerToMetricTimeSeries(data);
  }, [data]);

  const chartDef = useMemo(() => {
    if (!data) return null;
    return buildPerServerChartDefinition(data.servers);
  }, [data]);

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
      {chartDef && chartData ? (
        <MetricChartView
          def={chartDef}
          data={chartData}
          height={height}
          emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
          className="h-full"
          mode="stack"
          {...DASHBOARD_CHART_PROPS}
        />
      ) : (
        <MetricChartView
          def={totalPlayersChart}
          data={EMPTY_METRIC_TIME_SERIES}
          height={height}
          emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
          className="h-full"
          {...DASHBOARD_CHART_PROPS}
        />
      )}
      {showLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
          <LoadingState message="Loading player history…" />
        </div>
      ) : null}
    </div>
  );
}
