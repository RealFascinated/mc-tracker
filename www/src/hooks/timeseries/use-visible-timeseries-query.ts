import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTimeseriesDirtyRefresh } from "@/hooks/timeseries/use-timeseries-dirty-refresh";
import { useDashboardRefreshIntervalMs } from "@/lib/dashboard/refresh-context";

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
  const refreshIntervalMs = useDashboardRefreshIntervalMs();

  const query = useQuery({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
    enabled:
      isVisible &&
      enabled &&
      (options.enabled ?? true) &&
      options.queryFn != null,
    refetchInterval:
      isVisible && refreshIntervalMs !== false ? refreshIntervalMs : false,
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
