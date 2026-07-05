import { SettingsSection } from "../fields";
import type { AdminSettingsSectionProps } from "../section-props";
import { LlmConnectionSettingsSubsection } from "./connection-section";
import { LlmContextSettingsSubsection } from "./context-section";
import { LlmLimitsSettingsSubsection } from "./limits-section";
import { LlmModelsSettingsSubsection } from "./models-section";

export function LlmSettingsSection(props: AdminSettingsSectionProps) {
  return (
    <SettingsSection
      title="Chat / LLM"
      description="AI assistant connection, models, and agent limits. Leave base URL empty to disable chat."
    >
      <LlmConnectionSettingsSubsection {...props} />
      <LlmModelsSettingsSubsection {...props} />
      <LlmLimitsSettingsSubsection {...props} />
      <LlmContextSettingsSubsection {...props} />
    </SettingsSection>
  );
}
