export type LlmProviderId = "llama_cpp" | "openrouter" | "openai_compatible";

export function parseLlmProvider(value: string): LlmProviderId {
  if (value === "openrouter" || value === "openai_compatible") {
    return value;
  }
  return "llama_cpp";
}

export function llmProviderShowsApiKey(provider: LlmProviderId): boolean {
  return provider !== "llama_cpp";
}

export function llmProviderShowsParallelSlots(
  provider: LlmProviderId,
): boolean {
  return provider === "llama_cpp";
}

export function llmProviderSupportsThinkingEffort(
  provider: LlmProviderId,
): boolean {
  return provider === "llama_cpp" || provider === "openrouter";
}

export function llmBaseUrlPlaceholder(provider: LlmProviderId): string {
  switch (provider) {
    case "openrouter":
      return "https://openrouter.ai/api";
    case "openai_compatible":
      return "https://api.openai.com/v1";
    default:
      return "http://localhost:8080";
  }
}

export function llmModelPlaceholder(provider: LlmProviderId): string {
  switch (provider) {
    case "openrouter":
      return "openrouter/free";
    case "openai_compatible":
      return "gpt-4o-mini";
    default:
      return "default";
  }
}
