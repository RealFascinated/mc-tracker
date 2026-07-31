import { queryOptions } from "@tanstack/react-query";

import { getPinnedServers } from "@/lib/api/pinned-servers";
import { pinnedServersQueryKey } from "@/lib/api/query-keys";

export { pinnedServersQueryKey };

export function pinnedServersQueryOptions() {
  return queryOptions({
    queryKey: pinnedServersQueryKey,
    queryFn: getPinnedServers,
  });
}
