import { queryOptions } from "@tanstack/react-query";

import { createListQueryOptions } from "@/lib/api/list-query";
import {
  getServerTimeseries,
  getServers,
  getTotalTimeseries,
} from "@/lib/api/servers";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import {
  metricTimeWindowQueryKey,
  metricTimeWindowToEpochWindow,
} from "@/lib/metrics/time-window";

export const serversQueryKey = ["servers", "list"] as const;

export const serversQueryOptions = createListQueryOptions({
  queryKey: serversQueryKey,
  fetch: getServers,
});

export function serverTimeseriesQueryOptions(
  id: string,
  window: MetricTimeWindow,
) {
  return queryOptions({
    queryKey: [
      "servers",
      "timeseries",
      id,
      metricTimeWindowQueryKey(window),
    ] as const,
    queryFn: () => {
      const { from, to } = metricTimeWindowToEpochWindow(window);
      return getServerTimeseries(id, from, to);
    },
    enabled: id.length > 0,
  });
}

export function totalTimeseriesQueryOptions(window: MetricTimeWindow) {
  return queryOptions({
    queryKey: [
      "servers",
      "timeseries",
      "total",
      metricTimeWindowQueryKey(window),
    ] as const,
    queryFn: () => {
      const { from, to } = metricTimeWindowToEpochWindow(window);
      return getTotalTimeseries(from, to);
    },
  });
}
