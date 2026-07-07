import { Minus, Plus } from "lucide-react";

import { SettingsField, SettingsSubsection } from "../fields";
import type { AdminSettingsSectionProps } from "../section-props";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select/select";
import { NativeSelectOption } from "@/components/ui/native-select/option";
import { Switch } from "@/components/ui/switch";
import {
  getLlmProvider,
  parseLlmProvider,
} from "@/lib/admin/settings/llm-provider-ui";

export function LlmModelsSettingsSubsection({
  values,
  updateString,
  updateBoolean,
  updateLlmModel,
  addLlmModel,
  removeLlmModel,
}: AdminSettingsSectionProps) {
  const provider = getLlmProvider(parseLlmProvider(values.llmProvider));
  const showThinkingEffort =
    values.llmThinkingEnabled && provider.supportsThinkingEffort;

  return (
    <SettingsSubsection
      title="Models"
      description={provider.modelsDescription}
      bordered
    >
      <div className="space-y-2">
        {values.llmModels.map((entry, index) => (
          <div key={entry.id} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
              {index === 0 ? "Primary" : `Fallback ${index}`}
            </span>
            <Input
              id={index === 0 ? "llm-models-0" : undefined}
              value={entry.value}
              onChange={(event) => updateLlmModel(entry.id, event.target.value)}
              placeholder={provider.modelPlaceholder}
              spellCheck={false}
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Remove model"
              disabled={values.llmModels.length <= 1}
              onClick={() => removeLlmModel(entry.id)}
            >
              <Minus className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addLlmModel}>
          <Plus className="size-4" />
          Add model
        </Button>
      </div>
      <SettingsField
        label="Thinking"
        htmlFor="llm-thinking-enabled"
        hint="Enable model reasoning when supported. Shown in chat as a collapsible block."
        switchControl
      >
        <Switch
          id="llm-thinking-enabled"
          checked={values.llmThinkingEnabled}
          onCheckedChange={(checked) =>
            updateBoolean("llmThinkingEnabled", checked)
          }
        />
      </SettingsField>
      {showThinkingEffort ? (
        <SettingsField
          label="Thinking effort"
          htmlFor="llm-thinking-effort"
          hint={provider.thinkingEffortHint}
          className="max-w-xs"
        >
          <NativeSelect
            id="llm-thinking-effort"
            className="w-full"
            value={values.llmThinkingEffort}
            onChange={(event) =>
              updateString("llmThinkingEffort", event.target.value)
            }
          >
            <NativeSelectOption value="low">Low</NativeSelectOption>
            <NativeSelectOption value="medium">Medium</NativeSelectOption>
            <NativeSelectOption value="high">High</NativeSelectOption>
          </NativeSelect>
        </SettingsField>
      ) : null}
    </SettingsSubsection>
  );
}
