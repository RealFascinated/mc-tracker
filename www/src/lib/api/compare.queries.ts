import { queryOptions } from "@tanstack/react-query";

import { getServersCompareTimeseries } from "@/lib/api/compare";
import { MIN_COMPARE_SERVERS } from "@/lib/compare/ids";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { metricTimeWindowQueryKey } from "@/lib/metrics/time-window";

const serversCompareQueryKey = ["servers", "compare", "timeseries"] as const;

export function serversCompareQueryOptions(
  ids: string[],
  window: MetricTimeWindow,
) {
  const sortedIds = [...ids].sort();
  return queryOptions({
    queryKey: [
      ...serversCompareQueryKey,
      {
        ids: sortedIds,
        window: metricTimeWindowQueryKey(window),
      },
    ] as const,
    queryFn: () => getServersCompareTimeseries(ids, window),
    enabled: ids.length >= MIN_COMPARE_SERVERS,
  });
}
