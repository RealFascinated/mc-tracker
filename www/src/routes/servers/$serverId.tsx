import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardCardHeader } from "@/components/dashboard/dashboard-card-header";
import { ServerPlayersChart } from "@/components/dashboard/charts/server-players-chart";
import { DashboardSearchInput } from "@/components/dashboard/dashboard-search-input";
import { DashboardTimeControls } from "@/components/dashboard/dashboard-time-controls";
import {
  ServerDetailMeta,
  ServerIdentityHeader,
} from "@/components/dashboard/server-identity-header";
import { FadeInAnimation } from "@/components/motion/fade-in-animation";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import {
  SiteHeaderNav,
  SiteHeaderToolbar,
} from "@/components/site-header-toolbar";
import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import { asnDetailSearch } from "@/lib/api/asns";
import { ApiClientError } from "@/lib/api/client";
import { serverQueryOptions } from "@/lib/api/servers.queries";
import { useDashboardRefresh } from "@/lib/dashboard/use-dashboard-refresh";
import { pageTitle } from "@/lib/page-title";
import { embedHead, serverPageDescription } from "@/lib/embed-meta";
import { DEFAULT_METRIC_TIME_RANGE } from "@/lib/metrics/range";
import type { MetricTimeRange } from "@/lib/metrics/range";
import {
  metricTimeWindowFromSearch,
  parseMetricTimeWindowSearch,
} from "@/lib/metrics/time-window";

type ServerDetailSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
};

export const Route = createFileRoute("/servers/$serverId")({
  validateSearch: (search: Record<string, unknown>): ServerDetailSearch =>
    parseMetricTimeWindowSearch(search),
  loader: async ({ context: { queryClient }, params }) => {
    try {
      return await queryClient.ensureQueryData(
        serverQueryOptions(params.serverId),
      );
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        throw notFound();
      }
      throw error;
    }
  },
  head: ({ loaderData, match }) =>
    embedHead({
      title: pageTitle(loaderData?.name ?? "Server"),
      description: loaderData
        ? serverPageDescription(loaderData)
        : undefined,
      image: loaderData?.favicon,
      pathname: match.pathname,
    }),
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
  const [searchInput, setSearchInput] = useState("");

  const { data: server = initialServer } = useQuery({
    ...serverQueryOptions(serverId),
    initialData: initialServer,
    initialDataUpdatedAt: Date.now(),
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });

  const timeWindow = useMemo(
    () =>
      metricTimeWindowFromSearch({
        range: searchRange,
        from: searchFrom,
        to: searchTo,
      }),
    [searchFrom, searchRange, searchTo],
  );

  const setPresetTimeRange = useCallback(
    (range: MetricTimeRange) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          range: range === DEFAULT_METRIC_TIME_RANGE ? undefined : range,
          from: undefined,
          to: undefined,
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

  const navigateCustomTimeRange = useCallback(
    (from: number, to: number, options?: { replace?: boolean }) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          range: undefined,
          from,
          to,
        }),
        replace: options?.replace ?? false,
        resetScroll: false,
      });
    },
    [navigate],
  );
  const setCustomTimeRange = useCallback(
    (from: number, to: number) => {
      navigateCustomTimeRange(from, to, { replace: true });
    },
    [navigateCustomTimeRange],
  );
  const handleZoomToRange = useCallback(
    (from: number, to: number) => {
      navigateCustomTimeRange(
        from,
        Math.min(to, Math.floor(Date.now() / 1000)),
      );
    },
    [navigateCustomTimeRange],
  );

  return (
    <>
      <SiteHeaderNav>
        <DashboardTimeControls
          window={timeWindow}
          onPresetChange={setPresetTimeRange}
          onCustomChange={setCustomTimeRange}
        />
      </SiteHeaderNav>
      <SiteHeaderToolbar>
        <div className="dashboard-header-search-slot">
          <DashboardSearchInput
            value={searchInput}
            onChange={setSearchInput}
          />
        </div>
      </SiteHeaderToolbar>

      <main className="dashboard-shell server-detail-page">
          <Link
            to="/"
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
                      className="font-medium text-foreground underline-offset-4 hover:underline"
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
    </>
  );
}
