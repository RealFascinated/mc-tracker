import { apiFetch } from "@/lib/api/client";

export type SettingItem = {
  key: string;
  type: "BOOLEAN" | "STRING" | "INTEGER" | "ENUM";
  value: boolean | number | string;
  updatedAt?: string;
};

export type SettingsListResponse = {
  settings: SettingItem[];
};

export function getAdminSettings() {
  return apiFetch<SettingsListResponse>("/admin/settings");
}

export function patchAdminSetting(key: string, value: unknown) {
  return apiFetch<SettingItem>(`/admin/settings/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify({ value }),
  });
}
