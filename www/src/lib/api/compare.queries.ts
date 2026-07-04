import { queryOptions } from "@tanstack/react-query";

import { getServersCompareSummary } from "@/lib/api/compare";
import { MIN_COMPARE_SERVERS } from "@/lib/compare/ids";
import { MAX_METRIC_POINTS } from "@/lib/metrics/max-points";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { metricTimeWindowQueryKey } from "@/lib/metrics/time-window";

export const serversCompareQueryKey = ["servers", "compare"] as const;

export function serversCompareQueryOptions(
  ids: string[],
  window: MetricTimeWindow,
  maxPoints = MAX_METRIC_POINTS,
) {
  const sortedIds = [...ids].sort();
  return queryOptions({
    queryKey: [
      ...serversCompareQueryKey,
      {
        ids: sortedIds,
        window: metricTimeWindowQueryKey(window),
        maxPoints,
      },
    ] as const,
    queryFn: () => getServersCompareSummary(ids, window, maxPoints),
    enabled: ids.length >= MIN_COMPARE_SERVERS,
  });
}
