import type { SettingItem } from "@/lib/api/admin/settings";

export type LlmModelEntry = {
  id: string;
  value: string;
};

export type ThinkingEffortId = "low" | "medium" | "high";

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
  llmModels: LlmModelEntry[];
  llmMaxToolRounds: number;
  llmContextMaxTurns: number;
  llmToolMaxTokens: number;
  llmFinalMaxTokens: number;
  llmContextMax: number;
  llmContextReserve: number;
  llmTimeoutSecs: number;
  llmProvider: string;
  llmParallelSlots: number;
  llmThinkingEnabled: boolean;
  llmThinkingEffort: ThinkingEffortId;
  llmApiKeyConfigured: boolean;
};

const FIELD_KEYS: Record<
  Exclude<keyof SettingsFormValues, "llmApiKeyConfigured">,
  string
> = {
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
  llmModels: "llm_models",
  llmMaxToolRounds: "llm_max_tool_rounds",
  llmContextMaxTurns: "llm_context_max_turns",
  llmToolMaxTokens: "llm_tool_max_tokens",
  llmFinalMaxTokens: "llm_final_max_tokens",
  llmContextMax: "llm_context_max",
  llmContextReserve: "llm_context_reserve",
  llmTimeoutSecs: "llm_timeout_secs",
  llmProvider: "llm_provider",
  llmParallelSlots: "llm_parallel_slots",
  llmThinkingEnabled: "llm_thinking_enabled",
  llmThinkingEffort: "llm_thinking_effort",
};

function valueFromItem(
  item: SettingItem,
): boolean | number | string | string[] {
  return item.value;
}

function parseStringList(item: SettingItem | undefined): LlmModelEntry[] {
  if (!item || !Array.isArray(item.value)) {
    return [{ id: crypto.randomUUID(), value: "default" }];
  }
  return item.value
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => ({ id: crypto.randomUUID(), value }));
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
    llmModels: parseStringList(get("llm_models")),
    llmMaxToolRounds: valueFromItem(get("llm_max_tool_rounds")!) as number,
    llmContextMaxTurns: valueFromItem(get("llm_context_max_turns")!) as number,
    llmToolMaxTokens: valueFromItem(get("llm_tool_max_tokens")!) as number,
    llmFinalMaxTokens: valueFromItem(get("llm_final_max_tokens")!) as number,
    llmContextMax: valueFromItem(get("llm_context_max")!) as number,
    llmContextReserve: valueFromItem(get("llm_context_reserve")!) as number,
    llmTimeoutSecs: valueFromItem(get("llm_timeout_secs")!) as number,
    llmProvider: valueFromItem(get("llm_provider")!) as string,
    llmParallelSlots: valueFromItem(get("llm_parallel_slots")!) as number,
    llmThinkingEnabled: get("llm_thinking_enabled")
      ? (valueFromItem(get("llm_thinking_enabled")!) as boolean)
      : true,
    llmThinkingEffort: (get("llm_thinking_effort")
      ? (valueFromItem(get("llm_thinking_effort")!) as string)
      : "medium") as ThinkingEffortId,
    llmApiKeyConfigured: apiKeyConfigured,
  };
}

function valuesEqual(
  field: Exclude<keyof SettingsFormValues, "llmApiKeyConfigured">,
  loaded: SettingsFormValues,
  draft: SettingsFormValues,
): boolean {
  if (field === "llmModels") {
    const toModels = (models: LlmModelEntry[]) =>
      models.map((model) => model.value.trim()).filter(Boolean);
    return (
      JSON.stringify(toModels(loaded.llmModels)) ===
      JSON.stringify(toModels(draft.llmModels))
    );
  }
  return loaded[field] === draft[field];
}

export function dirtySettingPatches(
  loaded: SettingsFormValues,
  draft: SettingsFormValues,
  apiKeyDraft: string | null,
): Array<{ key: string; value: unknown }> {
  const patches: Array<{ key: string; value: unknown }> = [];
  for (const field of Object.keys(FIELD_KEYS) as Array<
    Exclude<keyof SettingsFormValues, "llmApiKeyConfigured">
  >) {
    if (!valuesEqual(field, loaded, draft)) {
      const value =
        field === "llmModels"
          ? draft.llmModels.map((model) => model.value.trim()).filter(Boolean)
          : draft[field];
      patches.push({ key: FIELD_KEYS[field], value });
    }
  }
  if (apiKeyDraft !== null) {
    patches.push({ key: "llm_api_key", value: apiKeyDraft });
  }
  return patches;
}
