import { keepPreviousData, queryOptions } from "@tanstack/react-query";

export function createListQueryOptions<T>({
  queryKey,
  fetch,
}: {
  queryKey: readonly string[];
  fetch: (search?: string) => Promise<T>;
}) {
  return (search?: string) => {
    const trimmed = search?.trim() || undefined;
    return queryOptions({
      queryKey: trimmed
        ? ([...queryKey, { search: trimmed }] as const)
        : queryKey,
      queryFn: () => fetch(trimmed),
      placeholderData: keepPreviousData,
    });
  };
}
