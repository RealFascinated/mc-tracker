import { apiFetch } from "@/lib/api/client";
import type { PartialError, TimeseriesResponse } from "@/lib/api/types";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { metricTimeWindowToEpochWindow } from "@/lib/metrics/time-window";

export type ServersCompareTimeseriesItem = {
  id: string;
  name: string;
} & TimeseriesResponse;

export type ServersCompareTimeseriesResponse = {
  from: number;
  to: number;
  servers: ServersCompareTimeseriesItem[];
  errors: PartialError[];
};

export function getServersCompareTimeseries(
  ids: string[],
  window: MetricTimeWindow,
) {
  const { from, to } = metricTimeWindowToEpochWindow(window);
  const params = new URLSearchParams({
    ids: ids.join(","),
    from: String(from),
    to: String(to),
  });
  return apiFetch<ServersCompareTimeseriesResponse>(
    `/servers/compare/timeseries?${params}`,
    { credentials: "omit" },
  );
}
