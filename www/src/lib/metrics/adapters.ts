import type { ServerTimeseriesResponse } from "@/lib/api/servers";
import {
  backfillMetricTimeSeries,
  buildMetricTimeSeries,
  type MetricTimeSeries,
} from "@/lib/api/metric-timeseries";

export function serverTimeseriesToMetric(
  data: ServerTimeseriesResponse,
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
