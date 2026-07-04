import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";

import { AsnIdentityHeader } from "@/components/dashboard/asn-identity-header";
import { AsnPlayersChart } from "@/components/dashboard/charts/asn-players-chart";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardCardHeader } from "@/components/dashboard/dashboard-card-header";
import { DashboardSearchInput } from "@/components/dashboard/dashboard-search-input";
import { ServerMetricsGrid } from "@/components/dashboard/grids/server-metrics-grid";
import { FadeInAnimation } from "@/components/motion/fade-in-animation";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import { SiteHeaderDashboard } from "@/components/site-header-dashboard";
import { useMetricTimeWindowControls } from "@/hooks/use-metric-time-window-controls";
import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import { usePersistedServerSort } from "@/hooks/use-persisted-server-sort";
import { useSearchParamNavigation } from "@/hooks/use-search-param-navigation";
import { asnDisplayName, parseAsnOrgSearchParam } from "@/lib/api/asns";
import { ensureQueryOrNotFound } from "@/lib/api/ensure-query-or-not-found";
import { asnQueryOptions } from "@/lib/api/asns.queries";
import {
  filterServersByPlatform,
  parseServerPlatformFilterParam,
} from "@/lib/api/platform";
import type { ServerPlatformFilter } from "@/lib/api/platform";
import {
  parseServerSortFieldParam,
  parseSortOrderParam,
  sortServersBy,
} from "@/lib/api/server-sort";
import type { ServerSortField, SortOrder } from "@/lib/api/server-sort";
import { withDashboardEntityQuery } from "@/lib/dashboard/entity-query";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import { pageTitle } from "@/lib/page-title";
import type { MetricTimeRange } from "@/lib/metrics/range";
import { parseMetricTimeWindowSearch } from "@/lib/metrics/time-window";

type AsnDetailSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
  asnOrg?: string;
  platform?: ServerPlatformFilter;
  sort?: ServerSortField;
  order?: SortOrder;
};

export const Route = createFileRoute("/asns/$asn")({
  validateSearch: (search: Record<string, unknown>): AsnDetailSearch => ({
    ...parseMetricTimeWindowSearch(search),
    asnOrg: parseAsnOrgSearchParam(search.asnOrg),
    platform: parseServerPlatformFilterParam(search.platform),
    sort: parseServerSortFieldParam(search.sort),
    order: parseSortOrderParam(search.order),
  }),
  loaderDeps: ({ search }) => ({
    asnOrg: parseAsnOrgSearchParam(search.asnOrg) ?? "",
  }),
  loader: async ({ context: { queryClient }, params, deps: { asnOrg } }) =>
    ensureQueryOrNotFound(() =>
      queryClient.ensureQueryData(asnQueryOptions(params.asn, asnOrg)),
    ),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: pageTitle(loaderData ? asnDisplayName(loaderData) : "Network"),
      },
    ],
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
    sort: urlSortField,
    order: urlOrder,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const { refreshIntervalMs } = useDashboardRefresh();
  const initialAsn = Route.useLoaderData();
  const [searchInput, setSearchInput] = useState("");
  const asnOrg = searchAsnOrg ?? "";
  const platformFilter: ServerPlatformFilter = urlPlatform ?? "all";
  const { serverSort, setServerSort } = usePersistedServerSort(navigate, {
    sort: urlSortField,
    order: urlOrder,
  });

  const { data: asnDetail = initialAsn } = useQuery(
    withDashboardEntityQuery(
      asnQueryOptions(asn, asnOrg),
      initialAsn,
      refreshIntervalMs,
    ),
  );

  const {
    timeWindow,
    setPresetTimeRange,
    setCustomTimeRange,
    handleZoomToRange,
  } = useMetricTimeWindowControls(
    { range: searchRange, from: searchFrom, to: searchTo },
    navigate,
  );
  const setPlatformFilter = useSearchParamNavigation<ServerPlatformFilter>(
    navigate,
    "platform",
    "all",
  );

  const filteredServers = useMemo(() => {
    const filtered = filterServersByPlatform(asnDetail.servers, platformFilter);
    return sortServersBy(filtered, serverSort);
  }, [asnDetail.servers, platformFilter, serverSort]);

  return (
    <>
      <SiteHeaderDashboard
        window={timeWindow}
        onPresetChange={setPresetTimeRange}
        onCustomChange={setCustomTimeRange}
        search={
          <DashboardSearchInput value={searchInput} onChange={setSearchInput} />
        }
      />

      <main className="dashboard-shell server-detail-page">
        <Link
          to="/asns"
          search={timeWindowSearch}
          className="server-detail-back inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to networks
        </Link>

        <FadeInAnimation>
          <DashboardCard className="server-detail-card">
            <AsnIdentityHeader asn={asnDetail} layout="page" />
          </DashboardCard>
        </FadeInAnimation>

        <MetricChartsScope
          window={timeWindow}
          onZoomToRange={handleZoomToRange}
        >
          <FadeInAnimation>
            <DashboardCard className="hero-chart-panel">
              <DashboardCardHeader title="Player history" />
              <AsnPlayersChart
                asn={asnDetail.asn}
                asnOrg={asnDetail.asnOrg}
                window={timeWindow}
                height={360}
              />
            </DashboardCard>
          </FadeInAnimation>

          <ServerMetricsGrid
            servers={filteredServers}
            window={timeWindow}
            platformFilter={platformFilter}
            onPlatformFilterChange={setPlatformFilter}
            sort={serverSort}
            onSortChange={setServerSort}
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
        </MetricChartsScope>
      </main>
    </>
  );
}
