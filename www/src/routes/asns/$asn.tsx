import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCallback, useMemo } from "react";

import { AsnIdentityHeader } from "@/components/dashboard/asn-identity-header";
import { AsnPlayersChart } from "@/components/dashboard/charts/asn-players-chart";
import {
  DashboardCard,
  DashboardCardHeader,
} from "@/components/dashboard/dashboard-card";
import { DashboardTimeControls } from "@/components/dashboard/dashboard-time-controls";
import { ServerMetricsGrid } from "@/components/dashboard/grids/server-metrics-grid";
import { SiteHeaderNav } from "@/components/site-header-toolbar";
import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import { asnDisplayName } from "@/lib/api/asns";
import { ApiClientError } from "@/lib/api/client";
import { asnQueryOptions } from "@/lib/api/asns.queries";
import {
  filterServersByPlatform,
  parseServerPlatformFilterParam
  
} from "@/lib/api/servers";
import type {ServerPlatformFilter} from "@/lib/api/servers";
import { useDashboardRefresh } from "@/lib/dashboard/refresh-context";
import { pageTitle } from "@/lib/page-title";
import { DEFAULT_METRIC_TIME_RANGE } from "@/lib/metrics/range";
import type { MetricTimeRange } from "@/lib/metrics/range";
import {
  metricTimeWindowFromSearch,
  parseMetricTimeWindowSearch,
} from "@/lib/metrics/time-window";

type AsnDetailSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
  asnOrg?: string;
  platform?: ServerPlatformFilter;
};

function parseAsnOrgParam(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const Route = createFileRoute("/asns/$asn")({
  validateSearch: (search: Record<string, unknown>): AsnDetailSearch => ({
    ...parseMetricTimeWindowSearch(search),
    asnOrg: parseAsnOrgParam(search.asnOrg),
    platform: parseServerPlatformFilterParam(search.platform),
  }),
  loaderDeps: ({ search }) => ({
    asnOrg: parseAsnOrgParam(search.asnOrg) ?? "",
  }),
  loader: async ({ context: { queryClient }, params, deps: { asnOrg } }) => {
    try {
      return await queryClient.ensureQueryData(
        asnQueryOptions(params.asn, asnOrg),
      );
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        throw notFound();
      }
      throw error;
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData ? asnDisplayName(loaderData) : "Network") }],
  }),
  component: AsnDetailPage,
});

function AsnDetailPage() {
  const { asn } = Route.useParams();
  const {
    range: searchRange,
    from: searchFrom,
    to: searchTo,
    asnOrg: searchAsnOrg,
    platform: urlPlatform,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const { refreshIntervalMs } = useDashboardRefresh();
  const initialAsn = Route.useLoaderData();
  const asnOrg = searchAsnOrg ?? "";
  const platformFilter: ServerPlatformFilter = urlPlatform ?? "all";

  const asnQuery = useQuery({
    ...asnQueryOptions(asn, asnOrg),
    initialData: initialAsn,
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

  const setPlatformFilter = useCallback(
    (platform: ServerPlatformFilter) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          platform: platform === "all" ? undefined : platform,
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

  const asnDetail = asnQuery.data;
  const filteredServers = useMemo(
    () => filterServersByPlatform(asnDetail.servers, platformFilter),
    [asnDetail.servers, platformFilter],
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

      <main className="dashboard-shell server-detail-page">
          <Link
            to="/"
            search={{ ...timeWindowSearch, view: "asn" }}
            className="server-detail-back inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to networks
          </Link>

          <DashboardCard className="server-detail-card motion-chart-reveal">
            <AsnIdentityHeader asn={asnDetail} layout="page" />
          </DashboardCard>

          <DashboardCard className="hero-chart-panel motion-chart-reveal">
            <DashboardCardHeader title="Player history" />
            <AsnPlayersChart
              asn={asnDetail.asn}
              asnOrg={asnDetail.asnOrg}
              window={timeWindow}
              height={360}
            />
          </DashboardCard>

          <ServerMetricsGrid
            servers={filteredServers}
            window={timeWindow}
            platformFilter={platformFilter}
            onPlatformFilterChange={setPlatformFilter}
            trackedServers={asnDetail.summary.trackedServers}
            section={{
              title: "Servers on this network",
              subtitleDefault: `${asnDetail.serverCount} tracked server${asnDetail.serverCount === 1 ? "" : "s"}`,
              subtitleFiltered: (shown, total) =>
                `Showing ${shown} of ${total} servers`,
              emptyTracked: "No servers are tracked on this network.",
              emptyFiltered: "No servers match the selected platform.",
              emptyFilteredHint: "Switch to All, Java, or Bedrock.",
            }}
          />
      </main>
    </>
  );
}
