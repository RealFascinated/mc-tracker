import {
  SettingsField,
  SettingsFieldGrid,
  SettingsSubsection,
} from "../fields";
import type { AdminSettingsSectionProps } from "../section-props";
import { Input } from "@/components/ui/input";
import {
  getLlmProvider,
  parseLlmProvider,
} from "@/lib/admin/settings/llm-provider-ui";

export function LlmContextSettingsSubsection({
  values,
  updateNumber,
}: AdminSettingsSectionProps) {
  const provider = getLlmProvider(parseLlmProvider(values.llmProvider));

  return (
    <SettingsSubsection
      title="Context window"
      description="How much conversation history is included in each prompt."
      bordered
    >
      <SettingsFieldGrid columns={3}>
        <SettingsField
          label="Max turn pairs"
          htmlFor="llm-context-max-turns"
          hint="Soft cap on user/assistant pairs in the prompt."
        >
          <Input
            id="llm-context-max-turns"
            type="number"
            min={1}
            value={values.llmContextMaxTurns}
            onChange={(event) =>
              updateNumber("llmContextMaxTurns", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
        <SettingsField
          label="Context max tokens"
          htmlFor="llm-context-max"
          hint={provider.contextMaxHint}
        >
          <Input
            id="llm-context-max"
            type="number"
            min={1}
            value={values.llmContextMax}
            onChange={(event) =>
              updateNumber("llmContextMax", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
        <SettingsField
          label="Reserve tokens"
          htmlFor="llm-context-reserve"
          hint="Tokens reserved for the model completion. Must be less than context max."
        >
          <Input
            id="llm-context-reserve"
            type="number"
            min={1}
            value={values.llmContextReserve}
            onChange={(event) =>
              updateNumber("llmContextReserve", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
      </SettingsFieldGrid>
    </SettingsSubsection>
  );
}
