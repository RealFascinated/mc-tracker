import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { PinnedServersGrid } from "@/components/dashboard/grids/pinned-servers-grid";
import { DashboardStatsRow } from "@/components/dashboard/stats/dashboard-stats-row";
import { HeroChartPanel } from "@/components/dashboard/charts/hero-chart-panel";
import { ServerMetricsGrid } from "@/components/dashboard/grids/server-metrics-grid";
import { LoadingState } from "@/components/loading-state";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import { useMetricTimeWindowControls } from "@/hooks/use-metric-time-window-controls";
import { usePersistedServerSort } from "@/hooks/use-persisted-server-sort";
import { useSearchParamNavigation } from "@/hooks/use-search-param-navigation";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
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

type ServersSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
  platform?: ServerPlatformFilter;
  sort?: ServerSortField;
  order?: SortOrder;
};

export const Route = createFileRoute("/servers/")({
  validateSearch: (search: Record<string, unknown>): ServersSearch => ({
    ...parseMetricTimeWindowSearch(search),
    platform: parseServerPlatformFilterParam(search.platform),
    sort: parseServerSortFieldParam(search.sort),
    order: parseSortOrderParam(search.order),
  }),
  loaderDeps: ({ search }) => ({
    serverSort: resolveServerSort(search),
  }),
  loader: async ({ context: { queryClient }, deps: { serverSort } }) => {
    await queryClient.ensureQueryData(serversQueryOptions(serverSort));
  },
  head: () => ({
    meta: [{ title: pageTitle("Servers") }],
  }),
  component: ServersPage,
});

function ServersPage() {
  const { refreshIntervalMs } = useDashboardRefresh();
  const { isAuthenticated } = useAuth();
  const {
    range: searchRange,
    from: searchFrom,
    to: searchTo,
    platform: urlPlatform,
    sort: urlSortField,
    order: urlOrder,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
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
    enabled: isAuthenticated,
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });

  const { timeWindow, handleZoomToRange } = useMetricTimeWindowControls(
    { range: searchRange, from: searchFrom, to: searchTo },
    navigate,
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
  const globalSummary = serversData?.summary;
  const showPageLoading = serversPending && !globalSummary;

  return (
    <>
      {showPageLoading ? (
        <LoadingState message="Loading dashboard…" centered />
      ) : !globalSummary && !serversData ? (
        <main className="dashboard-shell">
          <p className="text-destructive">Failed to load dashboard data.</p>
        </main>
      ) : (
        <main className="dashboard-shell">
          {globalSummary ? <DashboardStatsRow summary={globalSummary} /> : null}

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
              trackedServers={serversData.summary.trackedServers}
              pinnedServerIds={pinnedServerIds}
              showPinButtons={isAuthenticated}
            />
          </MetricChartsScope>
        </main>
      )}
    </>
  );
}
