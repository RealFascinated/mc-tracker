import { useQuery  } from "@tanstack/react-query";
import type {UseQueryResult} from "@tanstack/react-query";
import { useCallback } from "react";

import { TIMESERIES_REFETCH_MS } from "@/lib/api/timeseries-refresh";
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
