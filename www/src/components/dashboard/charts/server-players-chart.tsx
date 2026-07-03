import { useMemo } from "react";

import { PlayersMetricChart } from "@/components/dashboard/charts/players-metric-chart";
import { serverTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { createServerPlayersChart } from "@/lib/metrics/charts/players";
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
  const chartDef = useMemo(
    () => createServerPlayersChart(`server-players-${serverId}`),
    [serverId],
  );
  const timeseriesOptions = useMemo(
    () =>
      toVisibleTimeseriesOptions(
        serverTimeseriesQueryOptions(serverId, window),
      ),
    [serverId, window],
  );

  return (
    <PlayersMetricChart
      def={chartDef}
      timeseriesOptions={timeseriesOptions}
      enabled={serverId.length > 0}
      height={height}
    />
  );
}
