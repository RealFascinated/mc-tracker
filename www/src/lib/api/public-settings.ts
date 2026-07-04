import { apiFetch } from "@/lib/api/client";

import type { SettingsListResponse } from "@/lib/api/admin/settings";

export function getPublicSettings() {
  return apiFetch<SettingsListResponse>("/settings/public", {
    credentials: "omit",
  });
}

export function signUpEnabledFromSettings(
  settings: SettingsListResponse | undefined,
): boolean {
  const item = settings?.settings.find((s) => s.key === "sign_up_enabled");
  return item?.type === "BOOLEAN" && item.value === true;
}
