import { queryOptions } from "@tanstack/react-query";

import { getAdminUsers } from "@/lib/api/admin/users";

export const adminUsersQueryKey = ["admin", "users"] as const;

export function adminUsersQueryOptions() {
  return queryOptions({
    queryKey: adminUsersQueryKey,
    queryFn: getAdminUsers,
  });
}
