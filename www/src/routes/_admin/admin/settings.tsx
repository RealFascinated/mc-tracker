import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/app-sidebar-nav";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
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
    <>
      <PageHeader
        title="Settings"
        description="Runtime configuration stored in PostgreSQL and applied in memory."
      />

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <section className="app-shell-section">
          <div className="app-shell-section-header">
            <h2 className="app-shell-section-title">Metrics</h2>
            <p className="app-shell-section-description">
              VictoriaMetrics connection and push interval.
            </p>
          </div>
          <div className="app-shell-section-body app-shell-form-grid">
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
          </div>
        </section>

        <section className="app-shell-section">
          <div className="app-shell-section-header">
            <h2 className="app-shell-section-title">Pinger</h2>
            <p className="app-shell-section-description">
              Timeouts and retry behaviour when querying servers.
            </p>
          </div>
          <div className="app-shell-section-body app-shell-form-grid">
            <Field label="Timeout (ms)">
              <Input
                type="number"
                min={1}
                value={values.pingerTimeoutMs}
                onChange={(event) =>
                  updateNumber("pingerTimeoutMs", event.target.value)
                }
              />
            </Field>
            <Field label="Retry attempts">
              <Input
                type="number"
                min={1}
                value={values.pingerRetryAttempts}
                onChange={(event) =>
                  updateNumber("pingerRetryAttempts", event.target.value)
                }
              />
            </Field>
            <Field label="Retry delay (ms)">
              <Input
                type="number"
                min={0}
                value={values.pingerRetryDelayMs}
                onChange={(event) =>
                  updateNumber("pingerRetryDelayMs", event.target.value)
                }
              />
            </Field>
          </div>
        </section>

        <section className="app-shell-section">
          <div className="app-shell-section-header">
            <h2 className="app-shell-section-title">DNS cache</h2>
            <p className="app-shell-section-description">
              Cache resolved hostnames to reduce lookup overhead.
            </p>
          </div>
          <div className="app-shell-section-body app-shell-form-grid">
            <Field label="TTL (minutes)">
              <Input
                type="number"
                min={1}
                value={values.dnsCacheTtlMinutes}
                onChange={(event) =>
                  updateNumber("dnsCacheTtlMinutes", event.target.value)
                }
              />
            </Field>
            <label className="app-shell-checkbox-field sm:col-span-2">
              <input
                type="checkbox"
                checked={values.dnsCacheEnabled}
                onChange={(event) =>
                  updateBoolean("dnsCacheEnabled", event.target.checked)
                }
              />
              DNS cache enabled
            </label>
          </div>
        </section>

        <section className="app-shell-section">
          <div className="app-shell-section-header">
            <h2 className="app-shell-section-title">Access</h2>
            <p className="app-shell-section-description">
              Public origin and sign-up policy.
            </p>
          </div>
          <div className="app-shell-section-body app-shell-form-grid">
            <Field label="WWW origin">
              <Input
                value={values.wwwOrigin}
                onChange={(event) =>
                  updateString("wwwOrigin", event.target.value)
                }
                placeholder="https://tracker.example.com"
              />
            </Field>
            <label className="app-shell-checkbox-field">
              <input
                type="checkbox"
                checked={values.signUpEnabled}
                onChange={(event) =>
                  updateBoolean("signUpEnabled", event.target.checked)
                }
              />
              Sign-up enabled
            </label>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="brand"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </>
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
