import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { LoadingState } from "@/components/loading-state"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { adminSettingsQueryOptions } from "@/lib/api/admin/settings.queries"
import { pageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/_admin/admin/settings")({
  head: () => ({
    meta: [{ title: pageTitle("Admin settings") }],
  }),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminSettingsQueryOptions()),
  component: AdminSettingsPage,
})

function AdminSettingsPage() {
  const { data, isPending, error } = useQuery(adminSettingsQueryOptions())

  if (isPending) {
    return <LoadingState message="Loading settings…" />
  }

  if (error || !data) {
    return <p className="text-destructive">Failed to load settings.</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Read-only preview — edit forms will be added next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Setting
            label="Push interval"
            value={`${data.metricsPushIntervalSeconds}s`}
          />
          <Setting label="VM URL" value={data.victoriametricsUrl} />
          <Setting label="WWW origin" value={data.wwwOrigin || "—"} />
          <Setting label="API bind" value={`${data.apiAddress}:${data.apiPort}`} />
          <Setting
            label="Sign-up enabled"
            value={data.signUpEnabled ? "yes" : "no"}
          />
        </dl>
      </CardContent>
    </Card>
  )
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  )
}
