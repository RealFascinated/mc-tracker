import type { QueryFunction, QueryKey } from "@tanstack/react-query";

export type VisibleTimeseriesQueryOptions<TData> = {
  queryKey: readonly unknown[];
  queryFn: (() => Promise<TData>) | undefined;
  enabled?: boolean;
};

export type VisibleTimeseriesSource<
  TData,
  TQueryKey extends QueryKey = QueryKey,
> = {
  queryKey: TQueryKey;
  queryFn?: QueryFunction<TData, TQueryKey>;
  enabled?: unknown;
};

export function toVisibleTimeseriesOptions<
  TData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: VisibleTimeseriesSource<TData, TQueryKey>,
): VisibleTimeseriesQueryOptions<TData> {
  const { queryKey, queryFn, enabled } = options;
  return {
    queryKey,
    queryFn: queryFn
      ? () => Promise.resolve((queryFn as () => TData | Promise<TData>)())
      : undefined,
    enabled: typeof enabled === "boolean" ? enabled : undefined,
  };
}
