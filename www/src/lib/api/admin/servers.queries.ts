import { queryOptions } from "@tanstack/react-query";

import { getAdminServers } from "@/lib/api/admin/servers";

export const adminServersQueryKey = ["admin", "servers"] as const;

export function adminServersQueryOptions() {
  return queryOptions({
    queryKey: adminServersQueryKey,
    queryFn: getAdminServers,
  });
}
