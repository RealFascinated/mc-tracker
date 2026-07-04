import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardCardHeader } from "@/components/dashboard/dashboard-card-header";
import { ServerPlayersChart } from "@/components/dashboard/charts/server-players-chart";
import {
  ServerDetailMeta,
  ServerIdentityHeader,
} from "@/components/dashboard/server-identity-header";
import { FadeInAnimation } from "@/components/motion/fade-in-animation";
import { NotFoundPage } from "@/components/not-found-page";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import { useMetricTimeWindowControls } from "@/hooks/use-metric-time-window-controls";
import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import { asnDetailSearch } from "@/lib/api/asns";
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
          Back to dashboard
        </Link>

        <FadeInAnimation>
          <DashboardCard className="server-detail-card">
            <ServerIdentityHeader server={server} layout="page" />
            <div className="server-detail-body">
              <ServerDetailMeta server={server} />
              {server.asn ? (
                <p className="server-detail-asn-link text-sm text-muted-foreground">
                  View all servers on this network on the{" "}
                  <Link
                    to="/asns/$asn"
                    params={{ asn: server.asn }}
                    search={asnDetailSearch(server.asnOrg, timeWindowSearch)}
                    className="link-underline-animate font-medium text-foreground"
                  >
                    network page
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          </DashboardCard>
        </FadeInAnimation>

        <MetricChartsScope
          window={timeWindow}
          onZoomToRange={handleZoomToRange}
        >
          <FadeInAnimation>
            <DashboardCard className="hero-chart-panel">
              <DashboardCardHeader title="Player history" />
              <ServerPlayersChart
                serverId={server.id}
                window={timeWindow}
                height={360}
              />
            </DashboardCard>
          </FadeInAnimation>
        </MetricChartsScope>
    </main>
  );
}
