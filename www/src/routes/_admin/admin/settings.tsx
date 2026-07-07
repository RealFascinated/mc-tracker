import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminSettingsFormSections } from "@/components/admin/settings/form-sections";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import type { SettingsFormValues } from "@/lib/admin/settings/form";
import {
  dirtySettingPatches,
  settingsListToFormValues,
} from "@/lib/admin/settings/form";
import { patchAdminSetting } from "@/lib/api/admin/settings";
import { adminSettingsQueryOptions } from "@/lib/api/admin/settings.queries";
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
    key: "dnsCacheEnabled" | "signUpEnabled" | "llmThinkingEnabled",
    checked: boolean,
  ) {
    setDraft({
      ...currentValues(),
      [key]: checked,
    });
  }

  function updateLlmModel(id: string, value: string) {
    setDraft({
      ...currentValues(),
      llmModels: currentValues().llmModels.map((entry) =>
        entry.id === id ? { ...entry, value } : entry,
      ),
    });
  }

  function addLlmModel() {
    setDraft({
      ...currentValues(),
      llmModels: [
        ...currentValues().llmModels,
        { id: crypto.randomUUID(), value: "" },
      ],
    });
  }

  function removeLlmModel(id: string) {
    const current = currentValues().llmModels;
    if (current.length <= 1) {
      return;
    }
    setDraft({
      ...currentValues(),
      llmModels: current.filter((entry) => entry.id !== id),
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
    <form
      id="admin-settings-form"
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <PageHeader
        title="Settings"
        description="Configure how the tracker runs — metrics, pinging, chat, and access."
        actions={
          <Button
            type="submit"
            variant="brand"
            disabled={!isDirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      <AdminSettingsFormSections
        values={values}
        loaded={loaded}
        apiKeyDraft={apiKeyDraft}
        setApiKeyDraft={setApiKeyDraft}
        updateNumber={updateNumber}
        updateString={updateString}
        updateBoolean={updateBoolean}
        updateLlmModel={updateLlmModel}
        addLlmModel={addLlmModel}
        removeLlmModel={removeLlmModel}
      />
    </form>
  );
}

async function getAdminSettingsRefetch(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return queryClient.fetchQuery(adminSettingsQueryOptions());
}
