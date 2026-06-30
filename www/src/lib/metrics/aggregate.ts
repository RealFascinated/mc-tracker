import type { MetricTimeSeries } from "@/lib/api/metric-timeseries";
import {
  backfillMetricTimeSeries,
  buildMetricTimeSeries,
} from "@/lib/api/metric-timeseries";

export function sumPlayersOnlineSeries(
  seriesList: MetricTimeSeries[],
): MetricTimeSeries | null {
  if (seriesList.length === 0) {
    return null;
  }

  const filled = seriesList.map(backfillMetricTimeSeries);
  const first = filled[0];
  if (!first) {
    return null;
  }

  const timestamps = first.timestamps;
  const playersOnline = timestamps.map((_, index) => {
    let sum = 0;
    let hasAny = false;

    for (const entry of filled) {
      const value = entry.series.players_online?.[index];
      if (value != null) {
        sum += value;
        hasAny = true;
      }
    }

    return hasAny ? sum : null;
  });

  return buildMetricTimeSeries({
    from: first.from,
    to: first.to,
    step: first.step,
    timestamps,
    series: { players_online: playersOnline },
  });
}
