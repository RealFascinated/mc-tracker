import type { PlayersTimeseriesPayload } from "@/lib/api/types";
import {
  backfillMetricTimeSeries,
  buildMetricTimeSeries,
} from "@/lib/api/metric-timeseries";
import type { MetricTimeSeries } from "@/lib/api/metric-timeseries";

export function playersTimeseriesToMetric(
  data: PlayersTimeseriesPayload,
): MetricTimeSeries {
  return backfillMetricTimeSeries(
    buildMetricTimeSeries({
      from: data.from,
      to: data.to,
      step: data.step,
      timestamps: data.timestamps,
      series: { players_online: data.playersOnline },
    }),
  );
}
