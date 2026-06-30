export type VisibleTimeseriesQueryOptions<TData> = {
  queryKey: readonly unknown[];
  queryFn: (() => Promise<TData>) | undefined;
  enabled?: boolean;
};

export function toVisibleTimeseriesOptions<TData>(options: {
  queryKey: readonly unknown[];
  queryFn?: (context: never) => TData | Promise<TData>;
  enabled?: boolean;
}): VisibleTimeseriesQueryOptions<TData> {
  return {
    queryKey: options.queryKey,
    queryFn: options.queryFn
      ? () => Promise.resolve(options.queryFn!({} as never))
      : undefined,
    enabled: options.enabled,
  };
}
