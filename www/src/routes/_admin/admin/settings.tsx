import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { patchAdminSettings } from "@/lib/api/admin/settings";
import type {
  PatchSettingsRequest,
  SettingsResponse,
} from "@/lib/api/admin/settings";
import { adminSettingsQueryOptions } from "@/lib/api/admin/settings.queries";
import { errorMessage } from "@/lib/api/error-message";
import { pageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/admin/settings")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminSettingsQueryOptions()),
  head: () => ({
    meta: [{ title: pageTitle("Admin settings") }],
  }),
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
      setDraft(null);
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

  const loaded = data;
  const values: SettingsResponse = draft ?? loaded;
  const isDirty = draft !== null;

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
      metricsPushCron: next.metricsPushCron,
      signUpEnabled: next.signUpEnabled,
      wwwOrigin: next.wwwOrigin,
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

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-group">
      <h2 className="settings-group-title">{title}</h2>
      <div className="settings-fields">{children}</div>
    </section>
  );
}

function SettingsField({
  label,
  htmlFor,
  hint,
  switchControl = false,
  children,
}: {
  label: string;
  htmlFor: string;
  hint: string;
  switchControl?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-field">
      <div className="settings-field-label">
        <Label htmlFor={htmlFor} className="font-normal text-muted-foreground">
          {label}
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="settings-field-info"
              aria-label={`About ${label}`}
            >
              <CircleHelp className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <div
        className={cn(
          switchControl
            ? "settings-field-control--switch"
            : "settings-field-control",
        )}
      >
        {children}
      </div>
    </div>
  );
}
