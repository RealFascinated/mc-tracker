import type { UseQueryOptions } from "@tanstack/react-query";

export function withDashboardEntityQuery<T>(
  options: object,
  initialData: T,
  refreshIntervalMs: number | false,
): UseQueryOptions<T, Error, T, readonly unknown[]> {
  return {
    ...(options as UseQueryOptions<T, Error, T, readonly unknown[]>),
    initialData,
    initialDataUpdatedAt: Date.now(),
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  };
}
