import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import {
  getServer,
  getServerTimeseries,
  getServers,
  getTotalTimeseries,
  getPerServerTimeseries,
  searchServers,
} from "@/lib/api/servers";
import type { ServerSort } from "@/lib/api/server-sort";
import { DEFAULT_SERVER_SORT } from "@/lib/api/server-sort";
import {
  serverQueryKey,
  serversQueryKey,
  serversSearchQueryKey,
  serversTimeseriesQueryKey,
} from "@/lib/api/query-keys";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import {
  metricTimeWindowQueryKey,
  metricTimeWindowToEpochWindow,
} from "@/lib/metrics/time-window";

export { serverQueryKey, serversQueryKey, serversTimeseriesQueryKey };

export function serversQueryOptions(sort: ServerSort = DEFAULT_SERVER_SORT) {
  return queryOptions({
    queryKey: [...serversQueryKey, { sort }] as const,
    queryFn: () => getServers(sort),
    placeholderData: keepPreviousData,
  });
}

export function serverQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...serverQueryKey, id] as const,
    queryFn: () => getServer(id),
    enabled: id.length > 0,
  });
}

export function serversSearchQueryOptions(search: string, limit = 10) {
  const trimmed = search.trim();
  return queryOptions({
    queryKey: [...serversSearchQueryKey, { search: trimmed, limit }] as const,
    queryFn: () => searchServers(trimmed, limit),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function serverTimeseriesQueryOptions(
  id: string,
  window: MetricTimeWindow,
  dailyAvg?: boolean,
  weeklyAvg?: boolean,
) {
  return queryOptions({
    queryKey: [
      ...serversTimeseriesQueryKey,
      id,
      metricTimeWindowQueryKey(window),
      { dailyAvg, weeklyAvg },
    ] as const,
    queryFn: () => {
      const { from, to } = metricTimeWindowToEpochWindow(window);
      return getServerTimeseries(id, from, to, dailyAvg, weeklyAvg);
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

export function perServerTimeseriesQueryOptions(window: MetricTimeWindow) {
  return queryOptions({
    queryKey: [
      ...serversTimeseriesQueryKey,
      "per-server",
      metricTimeWindowQueryKey(window),
    ] as const,
    queryFn: () => {
      const { from, to } = metricTimeWindowToEpochWindow(window);
      return getPerServerTimeseries(from, to);
    },
  });
}
