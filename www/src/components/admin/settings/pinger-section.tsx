import { SettingsField, SettingsFieldGrid, SettingsSection } from "./fields";
import type { AdminSettingsSectionProps } from "./section-props";
import { Input } from "@/components/ui/input";

export function PingerSettingsSection({
  values,
  updateNumber,
}: AdminSettingsSectionProps) {
  return (
    <SettingsSection
      title="Pinger"
      description="How server status checks are timed and retried."
    >
      <SettingsFieldGrid columns={3}>
        <SettingsField
          label="Timeout"
          htmlFor="pinger-timeout-ms"
          hint="Maximum wait per ping attempt, in milliseconds."
        >
          <Input
            id="pinger-timeout-ms"
            type="number"
            min={1}
            value={values.pingerTimeoutMs}
            onChange={(event) =>
              updateNumber("pingerTimeoutMs", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
        <SettingsField
          label="Retry attempts"
          htmlFor="pinger-retry-attempts"
          hint="Retries after a failed ping."
        >
          <Input
            id="pinger-retry-attempts"
            type="number"
            min={1}
            value={values.pingerRetryAttempts}
            onChange={(event) =>
              updateNumber("pingerRetryAttempts", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
        <SettingsField
          label="Retry delay"
          htmlFor="pinger-retry-delay-ms"
          hint="Pause between retries, in milliseconds."
        >
          <Input
            id="pinger-retry-delay-ms"
            type="number"
            min={0}
            value={values.pingerRetryDelayMs}
            onChange={(event) =>
              updateNumber("pingerRetryDelayMs", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
      </SettingsFieldGrid>
    </SettingsSection>
  );
}
