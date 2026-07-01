import { useMemo } from "react";

import { PlayersMetricChart } from "@/components/dashboard/charts/players-metric-chart";
import { asnTimeseriesQueryOptions } from "@/lib/api/asns.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { createPlayersChart } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type AsnPlayersChartProps = {
  asn: string;
  asnOrg: string;
  window: MetricTimeWindow;
  height?: number;
};

export function AsnPlayersChart({
  asn,
  asnOrg,
  window,
  height = 360,
}: AsnPlayersChartProps) {
  const chartDef = useMemo(() => {
    const slug = `${asn}-${asnOrg}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
    return createPlayersChart(`asn-hero-players-${slug}`);
  }, [asn, asnOrg]);
  const timeseriesOptions = useMemo(
    () =>
      toVisibleTimeseriesOptions(
        asnTimeseriesQueryOptions(asn, asnOrg, window),
      ),
    [asn, asnOrg, window],
  );

  return (
    <PlayersMetricChart
      def={chartDef}
      timeseriesOptions={timeseriesOptions}
      enabled={asn.length > 0}
      height={height}
    />
  );
}
