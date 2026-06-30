import { useMemo } from "react";

import { LoadingState } from "@/components/loading-state";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import { sumPlayersOnlineSeries } from "@/lib/metrics/aggregate";
import { serverTimeseriesToMetric } from "@/lib/metrics/adapters";
import { totalPlayersChart } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { useServerTimeseriesBatch } from "@/lib/api/servers.queries";

const EMPTY_CHART_DATA = {
  from: 0,
  to: 0,
  step: null,
  timestamps: [] as number[],
  series: {} as Record<string, Array<number | null>>,
};

const chartProps = {
  hideHeader: true,
  showCurrentValues: false,
} as const;

type TotalPlayersChartProps = {
  serverIds: string[];
  window: MetricTimeWindow;
};

export function TotalPlayersChart({
  serverIds,
  window,
}: TotalPlayersChartProps) {
  const { data, isPending, isError } = useServerTimeseriesBatch(
    serverIds,
    window,
  );

  const chartData = useMemo(() => {
    if (data.length === 0) {
      return null;
    }
    return sumPlayersOnlineSeries(data.map(serverTimeseriesToMetric));
  }, [data]);

  if (serverIds.length === 0) {
    return (
      <MetricChartView
        def={totalPlayersChart}
        data={EMPTY_CHART_DATA}
        emptyMessage="No servers configured."
        height={300}
        {...chartProps}
      />
    );
  }

  if (isPending) {
    return (
      <LoadingState message="Loading player history…" className="h-[300px]" />
    );
  }

  if (isError) {
    return (
      <p className="px-4 py-8 text-sm text-destructive">
        Failed to load player history.
      </p>
    );
  }

  return (
    <MetricChartView
      def={totalPlayersChart}
      data={chartData ?? EMPTY_CHART_DATA}
      height={300}
      emptyMessage="No player history yet."
      {...chartProps}
    />
  );
}
