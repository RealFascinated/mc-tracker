import type { SettingItem } from "@/lib/api/admin/settings";

export type SettingsFormValues = {
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
  llmApiKeyConfigured: boolean;
};

const FIELD_KEYS: Record<keyof SettingsFormValues, string> = {
  pingerTimeoutMs: "pinger_timeout_ms",
  pingerRetryAttempts: "pinger_retry_attempts",
  pingerRetryDelayMs: "pinger_retry_delay_ms",
  dnsCacheEnabled: "dns_cache_enabled",
  dnsCacheTtlMinutes: "dns_cache_ttl_minutes",
  victoriametricsUrl: "victoriametrics_url",
  metricsPushCron: "metrics_push_cron",
  signUpEnabled: "sign_up_enabled",
  wwwOrigin: "www_origin",
  llmBaseUrl: "llm_base_url",
  llmModel: "llm_model",
  llmMaxToolRounds: "llm_max_tool_rounds",
  llmContextMaxTurns: "llm_context_max_turns",
  llmToolMaxTokens: "llm_tool_max_tokens",
  llmFinalMaxTokens: "llm_final_max_tokens",
  llmContextMax: "llm_context_max",
  llmContextReserve: "llm_context_reserve",
  llmTimeoutSecs: "llm_timeout_secs",
  llmProvider: "llm_provider",
  llmParallelSlots: "llm_parallel_slots",
  llmApiKeyConfigured: "llm_api_key",
};

function valueFromItem(item: SettingItem): boolean | number | string {
  return item.value;
}

export function settingsListToFormValues(
  settings: SettingItem[],
): SettingsFormValues {
  const byKey = new Map(settings.map((item) => [item.key, item]));
  const get = (key: string) => byKey.get(key);

  const llmApiKey = get("llm_api_key");
  const apiKeyConfigured =
    llmApiKey?.type === "STRING" &&
    typeof llmApiKey.value === "string" &&
    llmApiKey.value.length > 0 &&
    llmApiKey.value !== "********";

  return {
    pingerTimeoutMs: valueFromItem(get("pinger_timeout_ms")!) as number,
    pingerRetryAttempts: valueFromItem(get("pinger_retry_attempts")!) as number,
    pingerRetryDelayMs: valueFromItem(get("pinger_retry_delay_ms")!) as number,
    dnsCacheEnabled: valueFromItem(get("dns_cache_enabled")!) as boolean,
    dnsCacheTtlMinutes: valueFromItem(get("dns_cache_ttl_minutes")!) as number,
    victoriametricsUrl: valueFromItem(get("victoriametrics_url")!) as string,
    metricsPushCron: valueFromItem(get("metrics_push_cron")!) as string,
    signUpEnabled: valueFromItem(get("sign_up_enabled")!) as boolean,
    wwwOrigin: valueFromItem(get("www_origin")!) as string,
    llmBaseUrl: valueFromItem(get("llm_base_url")!) as string,
    llmModel: valueFromItem(get("llm_model")!) as string,
    llmMaxToolRounds: valueFromItem(get("llm_max_tool_rounds")!) as number,
    llmContextMaxTurns: valueFromItem(get("llm_context_max_turns")!) as number,
    llmToolMaxTokens: valueFromItem(get("llm_tool_max_tokens")!) as number,
    llmFinalMaxTokens: valueFromItem(get("llm_final_max_tokens")!) as number,
    llmContextMax: valueFromItem(get("llm_context_max")!) as number,
    llmContextReserve: valueFromItem(get("llm_context_reserve")!) as number,
    llmTimeoutSecs: valueFromItem(get("llm_timeout_secs")!) as number,
    llmProvider: valueFromItem(get("llm_provider")!) as string,
    llmParallelSlots: valueFromItem(get("llm_parallel_slots")!) as number,
    llmApiKeyConfigured: apiKeyConfigured,
  };
}

export function dirtySettingPatches(
  loaded: SettingsFormValues,
  draft: SettingsFormValues,
  apiKeyDraft: string | null,
): Array<{ key: string; value: unknown }> {
  const patches: Array<{ key: string; value: unknown }> = [];
  for (const field of Object.keys(FIELD_KEYS) as Array<
    keyof SettingsFormValues
  >) {
    if (field === "llmApiKeyConfigured") {
      continue;
    }
    if (loaded[field] !== draft[field]) {
      patches.push({ key: FIELD_KEYS[field], value: draft[field] });
    }
  }
  if (apiKeyDraft !== null) {
    patches.push({ key: "llm_api_key", value: apiKeyDraft });
  }
  return patches;
}
