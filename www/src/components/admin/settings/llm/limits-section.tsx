import {
  SettingsField,
  SettingsFieldGrid,
  SettingsSubsection,
} from "../fields";
import type { AdminSettingsSectionProps } from "../section-props";
import { Input } from "@/components/ui/input";

export function LlmLimitsSettingsSubsection({
  values,
  updateNumber,
}: AdminSettingsSectionProps) {
  return (
    <SettingsSubsection
      title="Agent limits"
      description="Tool loops, timeouts, and per-request token caps."
      bordered
    >
      <SettingsFieldGrid columns={3}>
        <SettingsField
          label="Max tool rounds"
          htmlFor="llm-max-tool-rounds"
          hint="Maximum tool-call loops per chat turn."
        >
          <Input
            id="llm-max-tool-rounds"
            type="number"
            min={1}
            value={values.llmMaxToolRounds}
            onChange={(event) =>
              updateNumber("llmMaxToolRounds", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
        <SettingsField
          label="Turn timeout"
          htmlFor="llm-timeout-secs"
          hint="Maximum time for a single chat turn, in seconds."
        >
          <Input
            id="llm-timeout-secs"
            type="number"
            min={1}
            value={values.llmTimeoutSecs}
            onChange={(event) =>
              updateNumber("llmTimeoutSecs", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
        <SettingsField
          label="Tool max tokens"
          htmlFor="llm-tool-max-tokens"
          hint="Token cap for intermediate tool-call completions."
        >
          <Input
            id="llm-tool-max-tokens"
            type="number"
            min={1}
            value={values.llmToolMaxTokens}
            onChange={(event) =>
              updateNumber("llmToolMaxTokens", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
      </SettingsFieldGrid>
      <SettingsField
        label="Final max tokens"
        htmlFor="llm-final-max-tokens"
        hint="Token cap for the final assistant message."
        className="max-w-xs"
      >
        <Input
          id="llm-final-max-tokens"
          type="number"
          min={1}
          value={values.llmFinalMaxTokens}
          onChange={(event) =>
            updateNumber("llmFinalMaxTokens", event.target.value)
          }
          inputMode="numeric"
        />
      </SettingsField>
    </SettingsSubsection>
  );
}
