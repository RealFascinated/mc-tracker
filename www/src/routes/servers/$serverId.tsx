import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCallback, useMemo } from "react";

import {
  DashboardCard,
  DashboardCardHeader,
} from "@/components/dashboard/dashboard-card";
import { ServerPlayersChart } from "@/components/dashboard/charts/server-players-chart";
import { DashboardTimeControls } from "@/components/dashboard/dashboard-time-controls";
import {
  ServerDetailMeta,
  ServerIdentityHeader,
} from "@/components/dashboard/server-identity-header";
import { LoadingState } from "@/components/loading-state";
import { SiteHeaderNav } from "@/components/site-header-toolbar";
import { asnDetailSearch } from "@/lib/api/asns";
import { ApiClientError } from "@/lib/api/client";
import { serverQueryOptions } from "@/lib/api/servers.queries";
import { useDashboardRefresh } from "@/lib/dashboard/refresh-context";
import { pageTitle } from "@/lib/page-title";
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
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.name ?? "Server") }],
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
  const { refreshIntervalMs } = useDashboardRefresh();
  const initialServer = Route.useLoaderData();

  const serverQuery = useQuery({
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

  const setCustomTimeRange = useCallback(
    (from: number, to: number) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          range: undefined,
          from,
          to,
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

  const server = serverQuery.data;

  return (
    <>
      <SiteHeaderNav>
        <DashboardTimeControls
          window={timeWindow}
          onPresetChange={setPresetTimeRange}
          onCustomChange={setCustomTimeRange}
        />
      </SiteHeaderNav>

      {!server ? (
        <main className="dashboard-shell">
          <LoadingState message="Loading server…" centered />
        </main>
      ) : (
        <main className="dashboard-shell server-detail-page">
          <Link
            to="/"
            className="server-detail-back inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to dashboard
          </Link>

          <DashboardCard className="server-detail-card motion-chart-reveal">
            <ServerIdentityHeader server={server} layout="page" />
            <div className="server-detail-body">
              <ServerDetailMeta server={server} />
              {server.asn ? (
                <p className="server-detail-asn-link text-sm text-muted-foreground">
                  View all servers on this network on the{" "}
                  <Link
                    to="/asns/$asn"
                    params={{ asn: server.asn }}
                    search={asnDetailSearch(server.asnOrg)}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    network page
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          </DashboardCard>

          <DashboardCard className="hero-chart-panel motion-chart-reveal">
            <DashboardCardHeader title="Player history" />
            <ServerPlayersChart
              serverId={server.id}
              window={timeWindow}
              height={360}
            />
          </DashboardCard>
        </main>
      )}
    </>
  );
}
