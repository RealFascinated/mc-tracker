import type { SettingsFormValues } from "@/lib/admin/settings/form";

export type AdminSettingsSectionProps = {
  values: SettingsFormValues;
  loaded: SettingsFormValues;
  apiKeyDraft: string | null;
  setApiKeyDraft: (value: string) => void;
  updateNumber: <TKey extends keyof SettingsFormValues>(
    key: TKey,
    raw: string,
  ) => void;
  updateString: <TKey extends keyof SettingsFormValues>(
    key: TKey,
    value: string,
  ) => void;
  updateBoolean: (
    key: "dnsCacheEnabled" | "signUpEnabled" | "llmThinkingEnabled",
    checked: boolean,
  ) => void;
  updateLlmModel: (id: string, value: string) => void;
  addLlmModel: () => void;
  removeLlmModel: (id: string) => void;
};
