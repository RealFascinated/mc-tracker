import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTimeseriesDirtyRefresh } from "@/hooks/timeseries/use-timeseries-dirty-refresh";
import { useDashboardRefreshIntervalMs } from "@/hooks/use-dashboard-refresh";

type VisibleTimeseriesSource<TData> = {
  queryKey: readonly unknown[];
  queryFn: (() => Promise<TData>) | undefined;
  enabled?: boolean;
};

export type VisibleTimeseriesQueryResult<TData> = {
  data: TData | undefined;
  isPending: boolean;
  isError: boolean;
};

export function useVisibleTimeseriesQuery<TData>(
  options: VisibleTimeseriesSource<TData>,
  isVisible: boolean,
  enabled = true,
): VisibleTimeseriesQueryResult<TData> {
  const refreshIntervalMs = useDashboardRefreshIntervalMs();

  const { data, dataUpdatedAt, isPending, isError, refetch } = useQuery({
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

  const refetchTimeseries = useCallback(() => refetch(), [refetch]);

  useTimeseriesDirtyRefresh({
    isVisible,
    dataUpdatedAt,
    refetch: refetchTimeseries,
  });

  return { data, isPending, isError };
}
