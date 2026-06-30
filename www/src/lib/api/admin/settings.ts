import { apiFetch } from "@/lib/api/client";

export type SettingsResponse = {
  pingerTimeoutMs: number;
  pingerRetryAttempts: number;
  pingerRetryDelayMs: number;
  dnsCacheEnabled: boolean;
  dnsCacheTtlMinutes: number;
  victoriametricsUrl: string;
  metricsPushIntervalSeconds: number;
  signUpEnabled: boolean;
  wwwOrigin: string;
};

export type PatchSettingsRequest = Partial<SettingsResponse>;

export function getAdminSettings() {
  return apiFetch<SettingsResponse>("/admin/settings");
}

export function patchAdminSettings(body: PatchSettingsRequest) {
  return apiFetch<SettingsResponse>("/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
