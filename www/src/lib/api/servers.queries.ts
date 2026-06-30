import { queryOptions, useQueries } from "@tanstack/react-query"

import { getServerTimeseries, getServers } from "@/lib/api/servers"
import type { MetricTimeWindow } from "@/lib/metrics/time-window"
import {
  metricTimeWindowQueryKey,
  metricTimeWindowToEpochWindow,
} from "@/lib/metrics/time-window"

export const serversQueryKey = ["servers", "list"] as const

export function serversQueryOptions() {
  return queryOptions({
    queryKey: serversQueryKey,
    queryFn: getServers,
  })
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
      const { from, to } = metricTimeWindowToEpochWindow(window)
      return getServerTimeseries(id, from, to)
    },
    enabled: id.length > 0,
  })
}

export function useServerTimeseriesBatch(
  serverIds: string[],
  window: MetricTimeWindow,
) {
  const queries = useQueries({
    queries: serverIds.map((id) => serverTimeseriesQueryOptions(id, window)),
  })

  const isPending = queries.some((query) => query.isPending)
  const isError = queries.some((query) => query.isError)
  const data = queries
    .map((query) => query.data)
    .filter((entry) => entry != null)

  return { queries, data, isPending, isError }
}
