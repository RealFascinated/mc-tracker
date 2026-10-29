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
      description="How server status checks are timed, retried, and filtered."
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
      <SettingsFieldGrid columns={3}>
        <SettingsField
          label="Outlier window"
          htmlFor="players-outlier-window"
          hint="Accepted player counts kept per server as the baseline. A count is only rejected once the window is full."
        >
          <Input
            id="players-outlier-window"
            type="number"
            min={1}
            value={values.playersOutlierWindow}
            onChange={(event) =>
              updateNumber("playersOutlierWindow", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
        <SettingsField
          label="Outlier ratio"
          htmlFor="players-outlier-ratio"
          hint="Counts more than this many times above (or below) the baseline median are ignored entirely. 0 disables the check."
        >
          <Input
            id="players-outlier-ratio"
            type="number"
            min={0}
            value={values.playersOutlierRatio}
            onChange={(event) =>
              updateNumber("playersOutlierRatio", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
        <SettingsField
          label="Outlier floor"
          htmlFor="players-outlier-floor"
          hint="Only reject counts when median × ratio reaches this high, so small servers can spike freely."
        >
          <Input
            id="players-outlier-floor"
            type="number"
            min={1}
            value={values.playersOutlierFloor}
            onChange={(event) =>
              updateNumber("playersOutlierFloor", event.target.value)
            }
            inputMode="numeric"
          />
        </SettingsField>
      </SettingsFieldGrid>
    </SettingsSection>
  );
}
