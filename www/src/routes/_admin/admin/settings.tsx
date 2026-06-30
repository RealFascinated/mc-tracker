import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patchAdminSettings } from "@/lib/api/admin/settings";
import type {
  PatchSettingsRequest,
  SettingsResponse,
} from "@/lib/api/admin/settings";
import { adminSettingsQueryOptions } from "@/lib/api/admin/settings.queries";
import { errorMessage } from "@/lib/api/error-message";
import { pageTitle } from "@/lib/page-title";

export const Route = createFileRoute("/_admin/admin/settings")({
  head: () => ({
    meta: [{ title: pageTitle("Admin settings") }],
  }),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminSettingsQueryOptions()),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminSettingsQueryOptions());
  const [draft, setDraft] = useState<SettingsResponse | null>(null);

  const saveMutation = useMutation({
    mutationFn: (body: PatchSettingsRequest) => patchAdminSettings(body),
    onSuccess: async (saved) => {
      toast.success("Settings saved");
      setDraft(saved);
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

  const loaded = data;
  const values: SettingsResponse = draft ?? loaded;

  function currentValues(): SettingsResponse {
    return draft ?? loaded;
  }

  function updateNumber<TKey extends keyof SettingsResponse>(
    key: TKey,
    raw: string,
  ) {
    setDraft({
      ...currentValues(),
      [key]: Number(raw),
    });
  }

  function updateString<TKey extends keyof SettingsResponse>(
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
    const next = currentValues();
    saveMutation.mutate({
      pingerTimeoutMs: next.pingerTimeoutMs,
      pingerRetryAttempts: next.pingerRetryAttempts,
      pingerRetryDelayMs: next.pingerRetryDelayMs,
      dnsCacheEnabled: next.dnsCacheEnabled,
      dnsCacheTtlMinutes: next.dnsCacheTtlMinutes,
      victoriametricsUrl: next.victoriametricsUrl,
      metricsPushIntervalSeconds: next.metricsPushIntervalSeconds,
      signUpEnabled: next.signUpEnabled,
      wwwOrigin: next.wwwOrigin,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Runtime configuration stored in PostgreSQL and applied in memory.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <Field label="Push interval (seconds)">
            <Input
              type="number"
              min={1}
              value={values.metricsPushIntervalSeconds}
              onChange={(event) =>
                updateNumber("metricsPushIntervalSeconds", event.target.value)
              }
            />
          </Field>
          <Field label="VM URL">
            <Input
              value={values.victoriametricsUrl}
              onChange={(event) =>
                updateString("victoriametricsUrl", event.target.value)
              }
            />
          </Field>
          <Field label="WWW origin">
            <Input
              value={values.wwwOrigin}
              onChange={(event) =>
                updateString("wwwOrigin", event.target.value)
              }
              placeholder="https://tracker.example.com"
            />
          </Field>
          <Field label="Pinger timeout (ms)">
            <Input
              type="number"
              min={1}
              value={values.pingerTimeoutMs}
              onChange={(event) =>
                updateNumber("pingerTimeoutMs", event.target.value)
              }
            />
          </Field>
          <Field label="Pinger retry attempts">
            <Input
              type="number"
              min={1}
              value={values.pingerRetryAttempts}
              onChange={(event) =>
                updateNumber("pingerRetryAttempts", event.target.value)
              }
            />
          </Field>
          <Field label="Pinger retry delay (ms)">
            <Input
              type="number"
              min={0}
              value={values.pingerRetryDelayMs}
              onChange={(event) =>
                updateNumber("pingerRetryDelayMs", event.target.value)
              }
            />
          </Field>
          <Field label="DNS cache TTL (minutes)">
            <Input
              type="number"
              min={1}
              value={values.dnsCacheTtlMinutes}
              onChange={(event) =>
                updateNumber("dnsCacheTtlMinutes", event.target.value)
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.dnsCacheEnabled}
              onChange={(event) =>
                updateBoolean("dnsCacheEnabled", event.target.checked)
              }
            />
            DNS cache enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.signUpEnabled}
              onChange={(event) =>
                updateBoolean("signUpEnabled", event.target.checked)
              }
            />
            Sign-up enabled
          </label>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              variant="brand"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
