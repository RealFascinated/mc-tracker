import { queryOptions } from "@tanstack/react-query"

import { getAdminSettings } from "@/lib/api/admin/settings"

export const adminSettingsQueryKey = ["admin", "settings"] as const

export function adminSettingsQueryOptions() {
  return queryOptions({
    queryKey: adminSettingsQueryKey,
    queryFn: getAdminSettings,
  })
}
