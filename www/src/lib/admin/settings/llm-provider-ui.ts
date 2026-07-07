export type LlmProviderId = "llama_cpp" | "openrouter" | "openai_compatible";

export type LlmProviderOption = {
  value: LlmProviderId;
  label: string;
  description: string;
  showsApiKey: boolean;
  showsParallelSlots: boolean;
  supportsThinkingEffort: boolean;
  baseUrlPlaceholder: string;
  modelPlaceholder: string;
  apiKeyHint: string;
  parallelSlotsHint: string;
  modelsDescription: string;
  thinkingEffortHint: string;
  contextMaxHint: string;
};

export const LLM_PROVIDER_OPTIONS: ReadonlyArray<LlmProviderOption> = [
  {
    value: "llama_cpp",
    label: "llama.cpp",
    description: "Local OpenAI-compatible server",
    showsApiKey: false,
    showsParallelSlots: true,
    supportsThinkingEffort: true,
    baseUrlPlaceholder: "http://localhost:8080",
    modelPlaceholder: "default",
    apiKeyHint: "",
    parallelSlotsHint:
      "llama.cpp slot affinity; match your server --parallel value.",
    modelsDescription:
      "Model names sent to the API. The first entry is primary.",
    thinkingEffortHint:
      "llama.cpp thinking_budget_tokens — caps reasoning length per request.",
    contextMaxHint: "Match your llama.cpp --ctx-size.",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    description: "Cloud models with automatic fallback",
    showsApiKey: true,
    showsParallelSlots: false,
    supportsThinkingEffort: true,
    baseUrlPlaceholder: "https://openrouter.ai/api",
    modelPlaceholder: "openrouter/free",
    apiKeyHint:
      "Required for OpenRouter. Set-only — leave blank to keep the current key.",
    parallelSlotsHint: "",
    modelsDescription:
      "Tried in order. OpenRouter falls back automatically if a model fails.",
    thinkingEffortHint:
      "OpenRouter reasoning.effort — higher uses more reasoning tokens.",
    contextMaxHint: "Model context window used for budgeting.",
  },
  {
    value: "openai_compatible",
    label: "OpenAI-compatible",
    description: "Any API that follows the OpenAI chat format",
    showsApiKey: true,
    showsParallelSlots: false,
    supportsThinkingEffort: false,
    baseUrlPlaceholder: "https://api.openai.com/v1",
    modelPlaceholder: "gpt-4o-mini",
    apiKeyHint:
      "Bearer token for the API. Set-only — leave blank to keep the current key.",
    parallelSlotsHint: "",
    modelsDescription:
      "Model names sent to the API. The first entry is primary.",
    thinkingEffortHint: "",
    contextMaxHint: "Model context window used for budgeting.",
  },
];

export function parseLlmProvider(value: string): LlmProviderId {
  if (value === "openrouter" || value === "openai_compatible") {
    return value;
  }
  return "llama_cpp";
}

export function getLlmProvider(id: LlmProviderId): LlmProviderOption {
  return (
    LLM_PROVIDER_OPTIONS.find((option) => option.value === id) ??
    LLM_PROVIDER_OPTIONS[0]
  );
}
