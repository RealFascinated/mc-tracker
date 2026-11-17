import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { ServerPlayersChart } from "@/components/dashboard/charts/server-players-chart";
import { ServerIdentityHeader } from "@/components/dashboard/server/identity-header";
import { Toggle } from "@/components/ui/toggle";
import { NotFoundPage } from "@/components/not-found-page";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import { useMetricTimeWindowControls } from "@/hooks/metrics/use-metric-time-window-controls";
import { useMetricTimeWindowLinkSearch } from "@/hooks/metrics/use-metric-time-window-link-search";
import { ensureQueryOrNotFound } from "@/lib/api/ensure-query-or-not-found";
import { serverQueryOptions } from "@/lib/api/servers.queries";
import { withDashboardEntityQuery } from "@/lib/dashboard/entity-query";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import { pageTitle } from "@/lib/page-title";
import type { MetricTimeRange } from "@/lib/metrics/range";
import { parseMetricTimeWindowSearch } from "@/lib/metrics/time-window";

type ServerDetailSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
};

export const Route = createFileRoute("/servers/$serverId")({
  validateSearch: (search: Record<string, unknown>): ServerDetailSearch =>
    parseMetricTimeWindowSearch(search),
  loader: async ({ context: { queryClient }, params }) =>
    ensureQueryOrNotFound(() =>
      queryClient.ensureQueryData(serverQueryOptions(params.serverId)),
    ),
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.name ?? "Server") }],
  }),
  notFoundComponent: () => (
    <NotFoundPage
      title="Server not found"
      description="No tracked server matches this address."
    />
  ),
  component: ServerDetailPage,
});

function ServerDetailPage() {
  const { serverId } = Route.useParams();
  const {
    range: searchRange,
    from: searchFrom,
    to: searchTo,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const { refreshIntervalMs } = useDashboardRefresh();
  const initialServer = Route.useLoaderData();

  const [showDailyAvg, setShowDailyAvg] = useState(false);
  const [showWeeklyAvg, setShowWeeklyAvg] = useState(false);

  const { data: server = initialServer } = useQuery(
    withDashboardEntityQuery(
      serverQueryOptions(serverId),
      initialServer,
      refreshIntervalMs,
    ),
  );

  const { timeWindow, handleZoomToRange } = useMetricTimeWindowControls(
    { range: searchRange, from: searchFrom, to: searchTo },
    navigate,
  );

  return (
    <main className="dashboard-shell server-detail-page">
      <Link
        to="/servers"
        search={timeWindowSearch}
        className="server-detail-back inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All servers
      </Link>

      <>
        <ServerIdentityHeader server={server} layout="page" />
      </>

      <MetricChartsScope window={timeWindow} onZoomToRange={handleZoomToRange}>
        <>
          <section className="hero-chart-panel">
            <div className="hero-chart-head">
              <h2 className="section-label">Player history</h2>
              <div className="flex items-center gap-1.5">
                <Toggle
                  pressed={showDailyAvg}
                  onPressedChange={setShowDailyAvg}
                  variant="outline"
                  size="sm"
                  className="data-[state=on]:border-monitor data-[state=on]:text-monitor dark:data-[state=on]:border-monitor dark:data-[state=on]:text-monitor data-[state=on]:font-semibold data-[state=off]:text-muted-foreground/60 data-[state=off]:border-input/60"
                  aria-label="Toggle daily average"
                >
                  Daily avg
                </Toggle>
                <Toggle
                  pressed={showWeeklyAvg}
                  onPressedChange={setShowWeeklyAvg}
                  variant="outline"
                  size="sm"
                  className="data-[state=on]:border-monitor data-[state=on]:text-monitor dark:data-[state=on]:border-monitor dark:data-[state=on]:text-monitor data-[state=on]:font-semibold data-[state=off]:text-muted-foreground/60 data-[state=off]:border-input/60"
                  aria-label="Toggle weekly average"
                >
                  Weekly avg
                </Toggle>
              </div>
            </div>
            <ServerPlayersChart
              serverId={server.id}
              window={timeWindow}
              height={360}
              avgOverlays={{
                dailyAvg: showDailyAvg,
                weeklyAvg: showWeeklyAvg,
              }}
            />
          </section>
        </>
      </MetricChartsScope>
    </main>
  );
}
