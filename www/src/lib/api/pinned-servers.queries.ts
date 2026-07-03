import { queryOptions } from "@tanstack/react-query";

import { getPinnedServers } from "@/lib/api/pinned-servers";

export const pinnedServersQueryKey = ["pinned-servers"] as const;

export function pinnedServersQueryOptions() {
  return queryOptions({
    queryKey: pinnedServersQueryKey,
    queryFn: getPinnedServers,
  });
}
