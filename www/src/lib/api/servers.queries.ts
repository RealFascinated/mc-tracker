import { queryOptions } from "@tanstack/react-query";

import { createListQueryOptions } from "@/lib/api/list-query";
import {
  getServer,
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

export const serverQueryKey = ["servers", "detail"] as const;

export const serversTimeseriesQueryKey = ["servers", "timeseries"] as const;

export const serversQueryOptions = createListQueryOptions({
  queryKey: serversQueryKey,
  fetch: getServers,
});

export function serverQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...serverQueryKey, id] as const,
    queryFn: () => getServer(id),
    enabled: id.length > 0,
  });
}

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
      ...serversTimeseriesQueryKey,
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
      ...serversTimeseriesQueryKey,
      "total",
      metricTimeWindowQueryKey(window),
    ] as const,
    queryFn: () => {
      const { from, to } = metricTimeWindowToEpochWindow(window);
      return getTotalTimeseries(from, to);
    },
  });
}
