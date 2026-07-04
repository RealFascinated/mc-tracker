import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  SettingsField,
  SettingsGroup,
} from "@/components/admin/settings-fields";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  dirtySettingPatches,
  settingsListToFormValues,
} from "@/lib/admin/settings-form";
import type { SettingsFormValues } from "@/lib/admin/settings-form";
import { patchAdminSetting } from "@/lib/api/admin/settings";
import { adminSettingsQueryOptions } from "@/lib/api/admin/settings.queries";
import {
  llmBaseUrlPlaceholder,
  llmModelPlaceholder,
  llmProviderShowsApiKey,
  llmProviderShowsParallelSlots,
  parseLlmProvider,
} from "@/lib/admin/llm-provider-ui";
import { errorMessage } from "@/lib/api/error-message";
import { pageTitle } from "@/lib/page-title";
import { privatePageHead } from "@/lib/embed-meta";

export const Route = createFileRoute("/_admin/admin/settings")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminSettingsQueryOptions()),
  head: () => privatePageHead(pageTitle("Admin settings")),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminSettingsQueryOptions());
  const [draft, setDraft] = useState<SettingsFormValues | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async ({
      loaded,
      next,
      apiKey,
    }: {
      loaded: SettingsFormValues;
      next: SettingsFormValues;
      apiKey: string | null;
    }) => {
      const patches = dirtySettingPatches(loaded, next, apiKey);
      await Promise.all(
        patches.map(({ key, value }) => patchAdminSetting(key, value)),
      );
      return getAdminSettingsRefetch(queryClient);
    },
    onSuccess: async (saved) => {
      toast.success("Settings saved");
      setDraft(null);
      setApiKeyDraft(null);
      queryClient.setQueryData(adminSettingsQueryOptions().queryKey, saved);
      await queryClient.invalidateQueries({
        queryKey: adminSettingsQueryOptions().queryKey,
      });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isPending) {
    return <LoadingState message="Loading settings…" />;
  }

  if (!data) {
    return <p className="text-destructive">Failed to load settings.</p>;
  }

  const loaded = settingsListToFormValues(data.settings);
  const values: SettingsFormValues = draft ?? loaded;
  const isDirty = draft !== null || apiKeyDraft !== null;
  const llmProvider = parseLlmProvider(values.llmProvider);
  const showLlmApiKey = llmProviderShowsApiKey(llmProvider);
  const showLlmParallelSlots = llmProviderShowsParallelSlots(llmProvider);

  function currentValues(): SettingsFormValues {
    return draft ?? loaded;
  }

  function updateNumber<TKey extends keyof SettingsFormValues>(
    key: TKey,
    raw: string,
  ) {
    setDraft({
      ...currentValues(),
      [key]: Number(raw),
    });
  }

  function updateString<TKey extends keyof SettingsFormValues>(
    key: TKey,
    value: string,
  ) {
    setDraft({
      ...currentValues(),
      [key]: value,
    });
  }

  function updateBoolean(
    key: "dnsCacheEnabled" | "signUpEnabled",
    checked: boolean,
  ) {
    setDraft({
      ...currentValues(),
      [key]: checked,
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate({
      loaded,
      next: currentValues(),
      apiKey: apiKeyDraft,
    });
  }

  return (
    <form id="admin-settings-form" onSubmit={handleSubmit}>
      <div className="settings-page">
        <div className="settings-panel-header">
          <div className="min-w-0">
            <h1 className="settings-panel-title">Settings</h1>
            <p className="settings-panel-description">
              Configure how the tracker runs.
            </p>
          </div>
          <Button
            type="submit"
            variant="brand"
            disabled={!isDirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>

        <SettingsGroup title="Metrics">
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
            label="VM URL"
            htmlFor="victoriametrics-url"
            hint="VictoriaMetrics ingest endpoint used for metric pushes."
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
        </SettingsGroup>

        <SettingsGroup title="Pinger">
          <SettingsField
            label="Timeout (ms)"
            htmlFor="pinger-timeout-ms"
            hint="Maximum wait time per ping attempt."
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
            hint="How many times to retry after a failed ping."
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
            label="Retry delay (ms)"
            htmlFor="pinger-retry-delay-ms"
            hint="Pause between retry attempts."
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
        </SettingsGroup>

        <SettingsGroup title="DNS cache">
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
            label="TTL (minutes)"
            htmlFor="dns-cache-ttl-minutes"
            hint="How long cached DNS entries remain valid."
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
        </SettingsGroup>

        <SettingsGroup title="Chat / LLM">
          <SettingsField
            label="Provider"
            htmlFor="llm-provider"
            hint="llama.cpp for local inference; OpenRouter for cloud models."
          >
            <select
              id="llm-provider"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={values.llmProvider}
              onChange={(event) =>
                updateString("llmProvider", event.target.value)
              }
            >
              <option value="llama_cpp">llama.cpp (local)</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai_compatible">OpenAI-compatible</option>
            </select>
          </SettingsField>
          <SettingsField
            label="LLM base URL"
            htmlFor="llm-base-url"
            hint="OpenAI-compatible API base. Leave empty to disable chat."
          >
            <Input
              id="llm-base-url"
              value={values.llmBaseUrl}
              onChange={(event) =>
                updateString("llmBaseUrl", event.target.value)
              }
              placeholder={llmBaseUrlPlaceholder(llmProvider)}
              spellCheck={false}
              className="font-mono"
            />
          </SettingsField>
          <SettingsField
            label="Model"
            htmlFor="llm-model"
            hint="Model name sent to the LLM API."
          >
            <Input
              id="llm-model"
              value={values.llmModel}
              onChange={(event) => updateString("llmModel", event.target.value)}
              placeholder={llmModelPlaceholder(llmProvider)}
              spellCheck={false}
            />
          </SettingsField>
          {showLlmApiKey ? (
            <SettingsField
              label="API key"
              htmlFor="llm-api-key"
              hint={
                llmProvider === "openrouter"
                  ? "Required for OpenRouter. Set-only — leave blank to keep the current key."
                  : "Bearer token for the API. Set-only — leave blank to keep the current key."
              }
            >
              <Input
                id="llm-api-key"
                type="password"
                autoComplete="new-password"
                placeholder={
                  loaded.llmApiKeyConfigured ? "********" : undefined
                }
                value={apiKeyDraft ?? ""}
                onChange={(event) => setApiKeyDraft(event.target.value)}
                spellCheck={false}
              />
            </SettingsField>
          ) : null}
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
            />
          </SettingsField>
          <SettingsField
            label="Max turn pairs in prompt"
            htmlFor="llm-context-max-turns"
            hint="Soft cap on user/assistant pairs included in the LLM prompt."
          >
            <Input
              id="llm-context-max-turns"
              type="number"
              min={1}
              value={values.llmContextMaxTurns}
              onChange={(event) =>
                updateNumber("llmContextMaxTurns", event.target.value)
              }
            />
          </SettingsField>
          <SettingsField
            label="Context max tokens"
            htmlFor="llm-context-max"
            hint={
              llmProvider === "llama_cpp"
                ? "Match your llama.cpp --ctx-size."
                : "Model context window size used for budgeting."
            }
          >
            <Input
              id="llm-context-max"
              type="number"
              min={1}
              value={values.llmContextMax}
              onChange={(event) =>
                updateNumber("llmContextMax", event.target.value)
              }
            />
          </SettingsField>
          <SettingsField
            label="Context reserve tokens"
            htmlFor="llm-context-reserve"
            hint="Tokens reserved for the model completion."
          >
            <Input
              id="llm-context-reserve"
              type="number"
              min={1}
              value={values.llmContextReserve}
              onChange={(event) =>
                updateNumber("llmContextReserve", event.target.value)
              }
            />
          </SettingsField>
          <SettingsField
            label="Timeout (seconds)"
            htmlFor="llm-timeout-secs"
            hint="Maximum time for a single chat turn."
          >
            <Input
              id="llm-timeout-secs"
              type="number"
              min={1}
              value={values.llmTimeoutSecs}
              onChange={(event) =>
                updateNumber("llmTimeoutSecs", event.target.value)
              }
            />
          </SettingsField>
          {showLlmParallelSlots ? (
            <SettingsField
              label="Parallel slots"
              htmlFor="llm-parallel-slots"
              hint="llama.cpp slot affinity; match your server --parallel value."
            >
              <Input
                id="llm-parallel-slots"
                type="number"
                min={1}
                value={values.llmParallelSlots}
                onChange={(event) =>
                  updateNumber("llmParallelSlots", event.target.value)
                }
              />
            </SettingsField>
          ) : null}
        </SettingsGroup>

        <SettingsGroup title="Access">
          <SettingsField
            label="WWW origin"
            htmlFor="www-origin"
            hint="Public URL of this tracker. Used for CORS and redirects."
          >
            <Input
              id="www-origin"
              value={values.wwwOrigin}
              onChange={(event) =>
                updateString("wwwOrigin", event.target.value)
              }
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
              onCheckedChange={(checked) =>
                updateBoolean("signUpEnabled", checked)
              }
            />
          </SettingsField>
        </SettingsGroup>
      </div>
    </form>
  );
}

async function getAdminSettingsRefetch(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return queryClient.fetchQuery(adminSettingsQueryOptions());
}
