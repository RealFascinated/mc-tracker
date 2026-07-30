import { useMemo } from "react";

import { PlayersMetricChart } from "@/components/dashboard/charts/players-metric-chart";
import { serverTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { createServerPlayersChart } from "@/lib/metrics/charts/players";
import type { AvgOverlayOptions } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type ServerPlayersChartProps = {
  serverId: string;
  window: MetricTimeWindow;
  avgOverlays?: AvgOverlayOptions;
  height?: number;
};

export function ServerPlayersChart({
  serverId,
  window,
  avgOverlays,
  height = 360,
}: ServerPlayersChartProps) {
  const chartDef = useMemo(
    () => createServerPlayersChart(`server-players-${serverId}`, "auto", avgOverlays),
    [serverId, avgOverlays],
  );
  const timeseriesOptions = useMemo(
    () =>
      toVisibleTimeseriesOptions(
        serverTimeseriesQueryOptions(
          serverId,
          window,
          avgOverlays?.dailyAvg,
          avgOverlays?.weeklyAvg,
        ),
      ),
    [serverId, window, avgOverlays?.dailyAvg, avgOverlays?.weeklyAvg],
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
