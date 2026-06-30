import { queryOptions } from "@tanstack/react-query";

import { createListQueryOptions } from "@/lib/api/list-query";
import {
  getServerTimeseries,
  getServers,
  getTotalTimeseries,
  searchServers,
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

export const serversSearchQueryKey = ["servers", "search"] as const;

export function serversSearchQueryOptions(search: string, limit = 10) {
  const trimmed = search.trim();
  return queryOptions({
    queryKey: [...serversSearchQueryKey, { search: trimmed, limit }] as const,
    queryFn: () => searchServers(trimmed, limit),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
  });
}

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
