import { apiFetch } from "@/lib/api/client";

export type SettingsResponse = {
  pingerTimeoutMs: number;
  pingerRetryAttempts: number;
  pingerRetryDelayMs: number;
  dnsCacheEnabled: boolean;
  dnsCacheTtlMinutes: number;
  victoriametricsUrl: string;
  metricsPushCron: string;
  signUpEnabled: boolean;
  wwwOrigin: string;
  llmBaseUrl: string;
  llmModel: string;
  llmMaxToolRounds: number;
  llmContextMaxTurns: number;
  llmToolMaxTokens: number;
  llmFinalMaxTokens: number;
  llmContextMax: number;
  llmContextReserve: number;
  llmTimeoutSecs: number;
  llmProvider: string;
  llmParallelSlots: number;
  llmApiKey?: string;
};

export type PatchSettingsRequest = Partial<
  Omit<SettingsResponse, "llmApiKey">
> & {
  llmApiKey?: string | null;
};

export function getAdminSettings() {
  return apiFetch<SettingsResponse>("/admin/settings");
}

export function patchAdminSettings(body: PatchSettingsRequest) {
  return apiFetch<SettingsResponse>("/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
