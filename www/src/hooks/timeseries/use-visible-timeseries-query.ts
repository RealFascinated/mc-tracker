import { useQuery  } from "@tanstack/react-query";
import type {UseQueryResult} from "@tanstack/react-query";
import { useCallback } from "react";

import { totalTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { TIMESERIES_REFETCH_MS } from "@/lib/api/timeseries-refresh";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { useTimeseriesDirtyRefresh } from "@/hooks/timeseries/use-timeseries-dirty-refresh";

type VisibleTimeseriesSource<TData> = {
  queryKey: readonly unknown[];
  queryFn: (() => Promise<TData>) | undefined;
  enabled?: boolean;
};

export function useVisibleTimeseriesQuery<TData>(
  options: VisibleTimeseriesSource<TData>,
  isVisible: boolean,
  enabled = true,
): UseQueryResult<TData> {
  const query = useQuery({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
    enabled:
      isVisible &&
      enabled &&
      (options.enabled ?? true) &&
      options.queryFn != null,
    refetchInterval: isVisible ? TIMESERIES_REFETCH_MS : false,
    refetchOnWindowFocus: isVisible,
  });

  const refetch = useCallback(() => query.refetch(), [query]);

  useTimeseriesDirtyRefresh({
    isVisible,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch,
  });

  return query;
}

export function useVisibleTotalTimeseriesQuery(window: MetricTimeWindow) {
  const { ref, isVisible } = useIntersectionVisible();
  const options = totalTimeseriesQueryOptions(window);
  const query = useVisibleTimeseriesQuery(
    {
      queryKey: options.queryKey,
      queryFn: options.queryFn
        ? () => Promise.resolve(options.queryFn!({} as never))
        : undefined,
    },
    isVisible,
  );

  return { ref, isVisible, ...query };
}
