import { queryOptions } from "@tanstack/react-query";

export function createListQueryOptions<T>({
  queryKey,
  fetch,
}: {
  queryKey: readonly string[];
  fetch: () => Promise<T>;
}) {
  return () =>
    queryOptions({
      queryKey,
      queryFn: fetch,
    });
}
