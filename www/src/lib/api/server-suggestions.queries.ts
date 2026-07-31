import { queryOptions } from "@tanstack/react-query";

import {
  getAdminServerSuggestions,
  getMyServerSuggestions,
} from "@/lib/api/server-suggestions";

export const myServerSuggestionsQueryKey = [
  "server-suggestions",
  "mine",
] as const;

export function myServerSuggestionsQueryOptions() {
  return queryOptions({
    queryKey: myServerSuggestionsQueryKey,
    queryFn: getMyServerSuggestions,
  });
}

export const adminServerSuggestionsQueryKey = (status: "pending" | "denied") =>
  ["admin", "server-suggestions", status] as const;

export function adminServerSuggestionsQueryOptions(
  status: "pending" | "denied",
) {
  return queryOptions({
    queryKey: adminServerSuggestionsQueryKey(status),
    queryFn: () => getAdminServerSuggestions(status),
  });
}
