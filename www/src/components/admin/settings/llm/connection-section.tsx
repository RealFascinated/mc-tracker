import { SettingsField, SettingsSubsection } from "../fields";
import type { AdminSettingsSectionProps } from "../section-props";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select/select";
import { NativeSelectOption } from "@/components/ui/native-select/option";
import {
  getLlmProvider,
  LLM_PROVIDER_OPTIONS,
  parseLlmProvider,
} from "@/lib/admin/settings/llm-provider-ui";

export function LlmConnectionSettingsSubsection({
  values,
  loaded,
  apiKeyDraft,
  setApiKeyDraft,
  updateNumber,
  updateString,
}: AdminSettingsSectionProps) {
  const provider = getLlmProvider(parseLlmProvider(values.llmProvider));

  return (
    <SettingsSubsection
      title="Connection"
      description="Provider, endpoint, and credentials."
    >
      <SettingsField
        label="Provider"
        htmlFor="llm-provider"
        hint="Determines default URLs, auth, and provider-specific options."
      >
        <NativeSelect
          id="llm-provider"
          className="w-full"
          value={values.llmProvider}
          onChange={(event) => updateString("llmProvider", event.target.value)}
        >
          {LLM_PROVIDER_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label} — {option.description}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </SettingsField>
      <SettingsField
        label="Base URL"
        htmlFor="llm-base-url"
        hint="OpenAI-compatible API base. Chat is disabled when empty."
      >
        <Input
          id="llm-base-url"
          value={values.llmBaseUrl}
          onChange={(event) => updateString("llmBaseUrl", event.target.value)}
          placeholder={provider.baseUrlPlaceholder}
          spellCheck={false}
          className="font-mono"
        />
      </SettingsField>
      {provider.showsApiKey ? (
        <SettingsField
          label="API key"
          htmlFor="llm-api-key"
          hint={provider.apiKeyHint}
        >
          <Input
            id="llm-api-key"
            type="password"
            autoComplete="new-password"
            placeholder={loaded.llmApiKeyConfigured ? "********" : undefined}
            value={apiKeyDraft ?? ""}
            onChange={(event) => setApiKeyDraft(event.target.value)}
            spellCheck={false}
            className="max-w-md"
          />
        </SettingsField>
      ) : null}
      {provider.showsParallelSlots ? (
        <SettingsField
          label="Parallel slots"
          htmlFor="llm-parallel-slots"
          hint={provider.parallelSlotsHint}
          className="max-w-xs"
        >
          <Input
            id="llm-parallel-slots"
            type="number"
            min={1}
            value={values.llmParallelSlots}
            onChange={(event) =>
              updateNumber("llmParallelSlots", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
      ) : null}
    </SettingsSubsection>
  );
}
