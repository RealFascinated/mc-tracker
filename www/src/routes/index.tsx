import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
  DashboardCard,
  DashboardCardHeader,
  DashboardRangeToggle,
} from "@/components/dashboard/dashboard-card";
import { ServerChartsGrid } from "@/components/dashboard/server-charts-grid";
import { TotalPlayersChart } from "@/components/dashboard/total-players-chart";
import { LoadingState } from "@/components/loading-state";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { serversQueryOptions } from "@/lib/api/servers.queries";
import { pageTitle } from "@/lib/page-title";
import {
  DEFAULT_METRIC_TIME_RANGE,
  METRIC_RANGE_OPTIONS,
  type MetricTimeRange,
  parseMetricRangeSearchParam,
} from "@/lib/metrics/range";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type DashboardSearch = {
  range?: MetricTimeRange;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    range: parseMetricRangeSearchParam(search.range),
  }),
  head: () => ({
    meta: [{ title: pageTitle("Dashboard") }],
  }),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(serversQueryOptions()),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isPending, error } = useQuery(serversQueryOptions());
  const { range: searchRange } = Route.useSearch();
  const navigate = Route.useNavigate();
  const timeRange = searchRange ?? DEFAULT_METRIC_TIME_RANGE;
  const setTimeRange = useCallback(
    (range: MetricTimeRange) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          range: range === DEFAULT_METRIC_TIME_RANGE ? undefined : range,
        }),
        replace: true,
      });
    },
    [navigate],
  );
  const window = useMemo<MetricTimeWindow>(
    () => ({ kind: "preset", range: timeRange }),
    [timeRange],
  );

  if (isPending) {
    return <LoadingState message="Loading servers…" centered />;
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <p className="text-destructive">Failed to load server list.</p>
      </main>
    );
  }

  const serverIds = data.servers.map((server) => server.id);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Public overview of tracked Minecraft servers.
          </p>
        </div>
        <DashboardRangeToggle
          value={timeRange}
          options={METRIC_RANGE_OPTIONS}
          onValueChange={setTimeRange}
          aria-label="Chart time range"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total players"
          value={String(data.summary.totalPlayers)}
        />
        <StatCard label="PC players" value={String(data.summary.playersPc)} />
        <StatCard label="PE players" value={String(data.summary.playersPe)} />
        <StatCard
          label="Tracked servers"
          value={String(data.summary.trackedServers)}
        />
      </div>

      <DashboardCard>
        <DashboardCardHeader
          title="Total players"
          subtitle="Sum of online players across all tracked servers."
        />
        <TotalPlayersChart serverIds={serverIds} window={window} />
      </DashboardCard>

      <ServerChartsGrid servers={data.servers} window={window} />
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="gap-1 border-b border-border py-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
