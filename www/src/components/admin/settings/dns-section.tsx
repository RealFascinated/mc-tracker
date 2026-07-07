import { SettingsField, SettingsSection } from "./fields";
import type { AdminSettingsSectionProps } from "./section-props";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function DnsCacheSettingsSection({
  values,
  updateNumber,
  updateBoolean,
}: AdminSettingsSectionProps) {
  return (
    <SettingsSection
      title="DNS cache"
      description="Reduce DNS lookups by caching resolved hostnames."
    >
      <SettingsField
        label="DNS cache enabled"
        htmlFor="dns-cache-enabled"
        hint="Resolve each hostname once per TTL window instead of every ping."
        switchControl
      >
        <Switch
          id="dns-cache-enabled"
          checked={values.dnsCacheEnabled}
          onCheckedChange={(checked) =>
            updateBoolean("dnsCacheEnabled", checked)
          }
        />
      </SettingsField>
      <SettingsField
        label="TTL"
        htmlFor="dns-cache-ttl-minutes"
        hint="How long cached DNS entries remain valid, in minutes."
        className="max-w-xs"
      >
        <Input
          id="dns-cache-ttl-minutes"
          type="number"
          min={1}
          value={values.dnsCacheTtlMinutes}
          onChange={(event) =>
            updateNumber("dnsCacheTtlMinutes", event.target.value)
          }
          inputMode="numeric"
          disabled={!values.dnsCacheEnabled}
        />
      </SettingsField>
    </SettingsSection>
  );
}
