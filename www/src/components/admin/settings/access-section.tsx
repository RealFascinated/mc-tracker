import { SettingsField, SettingsSection } from "./fields";
import type { AdminSettingsSectionProps } from "./section-props";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function AccessSettingsSection({
  values,
  updateString,
  updateBoolean,
}: AdminSettingsSectionProps) {
  return (
    <SettingsSection
      title="Access"
      description="Public URL and account registration."
    >
      <SettingsField
        label="WWW origin"
        htmlFor="www-origin"
        hint="Public URL of this tracker. Used for CORS and redirects."
      >
        <Input
          id="www-origin"
          value={values.wwwOrigin}
          onChange={(event) => updateString("wwwOrigin", event.target.value)}
          placeholder="https://tracker.example.com"
          spellCheck={false}
        />
      </SettingsField>
      <SettingsField
        label="Sign-up enabled"
        htmlFor="sign-up-enabled"
        hint="Allow new users to create accounts from the login page."
        switchControl
      >
        <Switch
          id="sign-up-enabled"
          checked={values.signUpEnabled}
          onCheckedChange={(checked) => updateBoolean("signUpEnabled", checked)}
        />
      </SettingsField>
    </SettingsSection>
  );
}
