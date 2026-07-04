import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AsnMetricsGrid } from "@/components/dashboard/grids/asn-metrics-grid";
import { PinnedServersGrid } from "@/components/dashboard/grids/pinned-servers-grid";
import { DashboardTimeControls } from "@/components/dashboard/dashboard-time-controls";
import { DashboardRangeToggle } from "@/components/dashboard/dashboard-range-toggle";
import type { DashboardRangeOption } from "@/components/dashboard/dashboard-range-toggle";
import { DashboardStatsRow } from "@/components/dashboard/stats/dashboard-stats-row";
import { HeroChartPanel } from "@/components/dashboard/charts/hero-chart-panel";
import { ServerMetricsGrid } from "@/components/dashboard/grids/server-metrics-grid";
import { DashboardSearchInput } from "@/components/dashboard/dashboard-search-input";
import { LoadingState } from "@/components/loading-state";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import {
  SiteHeaderNav,
  SiteHeaderToolbar,
} from "@/components/site-header-toolbar";
import { useMetricTimeWindowControls } from "@/hooks/use-metric-time-window-controls";
import { usePersistedServerSort } from "@/hooks/use-persisted-server-sort";
import { useSearchParamNavigation } from "@/hooks/use-search-param-navigation";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import { parseDashboardViewParam } from "@/lib/dashboard/dashboard-search";
import type { DashboardView } from "@/lib/dashboard/dashboard-search";
import { asnsQueryOptions } from "@/lib/api/asns.queries";
import {
  filterServersByPlatform,
  parseServerPlatformFilterParam,
} from "@/lib/api/platform";
import type { ServerPlatformFilter } from "@/lib/api/platform";
import {
  parseServerSortFieldParam,
  parseSortOrderParam,
  resolveServerSort,
} from "@/lib/api/server-sort";
import type { ServerSortField, SortOrder } from "@/lib/api/server-sort";
import { serversQueryOptions } from "@/lib/api/servers.queries";
import { pinnedServersQueryOptions } from "@/lib/api/pinned-servers.queries";
import { useAuth } from "@/lib/auth/context";
import { pageTitle } from "@/lib/page-title";
import type { MetricTimeRange } from "@/lib/metrics/range";
import { parseMetricTimeWindowSearch } from "@/lib/metrics/time-window";

const DASHBOARD_VIEW_OPTIONS: Array<DashboardRangeOption<DashboardView>> = [
  { value: "server", shortLabel: "Servers", label: "Per server" },
  { value: "asn", shortLabel: "ASNs", label: "Per ASN" },
];

type DashboardSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
  view?: DashboardView;
  platform?: ServerPlatformFilter;
  sort?: ServerSortField;
  order?: SortOrder;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    ...parseMetricTimeWindowSearch(search),
    view: parseDashboardViewParam(search.view),
    platform: parseServerPlatformFilterParam(search.platform),
    sort: parseServerSortFieldParam(search.sort),
    order: parseSortOrderParam(search.order),
  }),
  loaderDeps: ({ search }) => ({
    view: search.view ?? "server",
    serverSort: resolveServerSort(search),
  }),
  loader: async ({ context: { queryClient }, deps: { view, serverSort } }) => {
    await queryClient.ensureQueryData(serversQueryOptions(serverSort));
    if (view === "asn") {
      await queryClient.ensureQueryData(asnsQueryOptions());
    }
  },
  head: () => ({
    meta: [{ title: pageTitle("Dashboard") }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { refreshIntervalMs } = useDashboardRefresh();
  const { isAuthenticated } = useAuth();
  const {
    range: searchRange,
    from: searchFrom,
    to: searchTo,
    view: urlView,
    platform: urlPlatform,
    sort: urlSortField,
    order: urlOrder,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const dashboardView = urlView ?? "server";
  const [searchInput, setSearchInput] = useState("");
  const platformFilter: ServerPlatformFilter = urlPlatform ?? "all";
  const { serverSort, setServerSort } = usePersistedServerSort(navigate, {
    sort: urlSortField,
    order: urlOrder,
  });

  const { data: serversData, isPending: serversPending } = useQuery({
    ...serversQueryOptions(serverSort),
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });
  const { data: pinnedServersData } = useQuery({
    ...pinnedServersQueryOptions(),
    enabled: isAuthenticated && dashboardView === "server",
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });
  const { data: asnsData, isPending: asnsPending } = useQuery({
    ...asnsQueryOptions(),
    enabled: dashboardView === "asn",
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });

  const {
    timeWindow,
    setPresetTimeRange,
    setCustomTimeRange,
    handleZoomToRange,
  } = useMetricTimeWindowControls(
    { range: searchRange, from: searchFrom, to: searchTo },
    navigate,
  );
  const setDashboardView = useSearchParamNavigation<DashboardView>(
    navigate,
    "view",
    "server",
  );
  const setPlatformFilter = useSearchParamNavigation<ServerPlatformFilter>(
    navigate,
    "platform",
    "all",
  );
  const filteredServers = useMemo(
    () => filterServersByPlatform(serversData?.servers ?? [], platformFilter),
    [platformFilter, serversData?.servers],
  );
  const pinnedServers = pinnedServersData?.servers ?? [];
  const pinnedServerIds = useMemo(() => {
    const servers = pinnedServersData?.servers;
    if (!servers) {
      return new Set<string>();
    }
    return new Set(servers.map((server) => server.id));
  }, [pinnedServersData?.servers]);
  const activeData = dashboardView === "asn" ? asnsData : serversData;
  const activePending = dashboardView === "asn" ? asnsPending : serversPending;
  const globalSummary = serversData?.summary;
  const showInitialLoading = activePending && !activeData;
  const showPageLoading = serversPending && !globalSummary;

  return (
    <>
      <SiteHeaderNav>
        <div className="site-header-controls">
          <DashboardTimeControls
            window={timeWindow}
            onPresetChange={setPresetTimeRange}
            onCustomChange={setCustomTimeRange}
          />
          <DashboardRangeToggle
            value={dashboardView}
            options={DASHBOARD_VIEW_OPTIONS}
            onValueChange={setDashboardView}
            aria-label="Dashboard view"
            className="site-header-view-toggle"
          />
        </div>
      </SiteHeaderNav>
      <SiteHeaderToolbar>
        <div className="dashboard-header-search-slot">
          {dashboardView === "server" ? (
            <DashboardSearchInput
              value={searchInput}
              onChange={setSearchInput}
            />
          ) : null}
        </div>
      </SiteHeaderToolbar>

      {showPageLoading ? (
        <LoadingState message="Loading dashboard…" centered />
      ) : !globalSummary && !activeData ? (
        <main className="dashboard-shell">
          <p className="text-destructive">Failed to load dashboard data.</p>
        </main>
      ) : (
        <main className="dashboard-shell">
          {globalSummary ? <DashboardStatsRow summary={globalSummary} /> : null}

          {showInitialLoading ? (
            <LoadingState
              message={
                dashboardView === "asn"
                  ? "Loading networks…"
                  : "Loading servers…"
              }
              centered
            />
          ) : !activeData ? (
            <p className="text-destructive">Failed to load dashboard data.</p>
          ) : (
            <MetricChartsScope
              window={timeWindow}
              onZoomToRange={handleZoomToRange}
            >
              <HeroChartPanel
                hasServers={
                  globalSummary ? globalSummary.trackedServers > 0 : false
                }
                window={timeWindow}
              />

              {dashboardView === "asn" ? (
                <AsnMetricsGrid
                  asns={asnsData?.asns ?? []}
                  window={timeWindow}
                  trackedAsns={asnsData?.summary.trackedAsns ?? 0}
                />
              ) : (
                <>
                  {pinnedServers.length > 0 ? (
                    <PinnedServersGrid
                      servers={pinnedServers}
                      window={timeWindow}
                    />
                  ) : null}
                  <ServerMetricsGrid
                    servers={filteredServers}
                    window={timeWindow}
                    platformFilter={platformFilter}
                    onPlatformFilterChange={setPlatformFilter}
                    sort={serverSort}
                    onSortChange={setServerSort}
                    trackedServers={serversData?.summary.trackedServers ?? 0}
                    pinnedServerIds={pinnedServerIds}
                    showPinButtons={isAuthenticated}
                  />
                </>
              )}
            </MetricChartsScope>
          )}
        </main>
      )}
    </>
  );
}
