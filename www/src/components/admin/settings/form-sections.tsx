import { AccessSettingsSection } from "./access-section";
import { DnsCacheSettingsSection } from "./dns-section";
import { LlmSettingsSection } from "./llm/section";
import { MetricsSettingsSection } from "./metrics-section";
import { PingerSettingsSection } from "./pinger-section";
import type { AdminSettingsSectionProps } from "./section-props";

export function AdminSettingsFormSections(props: AdminSettingsSectionProps) {
  return (
    <div className="flex flex-col gap-6">
      <MetricsSettingsSection {...props} />
      <PingerSettingsSection {...props} />
      <DnsCacheSettingsSection {...props} />
      <LlmSettingsSection {...props} />
      <AccessSettingsSection {...props} />
    </div>
  );
}
