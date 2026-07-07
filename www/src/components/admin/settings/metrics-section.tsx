import { SettingsField, SettingsFieldGrid, SettingsSection } from "./fields";
import type { AdminSettingsSectionProps } from "./section-props";
import { Input } from "@/components/ui/input";

export function MetricsSettingsSection({
  values,
  updateString,
}: AdminSettingsSectionProps) {
  return (
    <SettingsSection
      title="Metrics"
      description="Where player-count samples are pushed and how often."
    >
      <SettingsFieldGrid>
        <SettingsField
          label="Push cron"
          htmlFor="metrics-push-cron"
          hint="Six-field cron with seconds. Every 15 seconds is */15 * * * * *."
        >
          <Input
            id="metrics-push-cron"
            value={values.metricsPushCron}
            onChange={(event) =>
              updateString("metricsPushCron", event.target.value)
            }
            placeholder="*/15 * * * * *"
            spellCheck={false}
            className="font-mono"
          />
        </SettingsField>
        <SettingsField
          label="VictoriaMetrics URL"
          htmlFor="victoriametrics-url"
          hint="Ingest endpoint used for metric pushes."
        >
          <Input
            id="victoriametrics-url"
            value={values.victoriametricsUrl}
            onChange={(event) =>
              updateString("victoriametricsUrl", event.target.value)
            }
            placeholder="http://localhost:8428"
            spellCheck={false}
            className="font-mono"
          />
        </SettingsField>
      </SettingsFieldGrid>
    </SettingsSection>
  );
}
