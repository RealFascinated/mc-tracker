import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Grid2x2, Rows3 } from "lucide-react";
import { lazy, Suspense, useMemo } from "react";

import { DashboardStatsRow } from "@/components/dashboard/stats/dashboard-stats-row";
import { HeroChartPanel } from "@/components/dashboard/charts/hero-chart-panel";
import { ServerMetricsGrid } from "@/components/dashboard/grids/server-metrics-grid";
import { ServersTable } from "@/components/dashboard/tables/servers-table";
import type {
  SortField,
  SortDirection,
} from "@/components/dashboard/tables/servers-table";
import { DashboardLoadingSkeleton } from "@/components/dashboard/dashboard-loading-skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMetricTimeWindowControls } from "@/hooks/metrics/use-metric-time-window-controls";
import { usePersistedServerSort } from "@/hooks/use-persisted-server-sort";
import { useSearchParamNavigation } from "@/hooks/use-search-param-navigation";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import {
  filterServersByPlatform,
  parseServerPlatformFilterParam,
  platformFilterEmptyCopy,
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

type ViewMode = "cards" | "table";

// dnd-kit (drag reordering) only loads once a user actually has pins.
const PinnedServersGrid = lazy(() =>
  import("@/components/dashboard/grids/pinned-servers-grid").then((mod) => ({
    default: mod.PinnedServersGrid,
  })),
);

const TABLE_SORT_FIELDS = [
  "name",
  "players",
  "peak24h",
  "peakAllTime",
  "trend24h",
  "trend7d",
  "trend30d",
] as const;

function parseTableSortFieldParam(value: unknown): SortField | undefined {
  if (
    typeof value === "string" &&
    (TABLE_SORT_FIELDS as readonly string[]).includes(value)
  ) {
    return value as SortField;
  }
  return undefined;
}

type ServersSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
  platform?: ServerPlatformFilter;
  sort?: ServerSortField;
  order?: SortOrder;
  view?: ViewMode;
  tableSort?: SortField;
  tableOrder?: SortDirection;
};

export const Route = createFileRoute("/servers/")({
  validateSearch: (search: Record<string, unknown>): ServersSearch => ({
    ...parseMetricTimeWindowSearch(search),
    platform: parseServerPlatformFilterParam(search.platform),
    sort: parseServerSortFieldParam(search.sort),
    order: parseSortOrderParam(search.order),
    view: search.view === "cards" ? "cards" : undefined,
    tableSort: parseTableSortFieldParam(search.tableSort),
    tableOrder: parseSortOrderParam(search.tableOrder),
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
    view: urlView,
    tableSort: urlTableSort,
    tableOrder: urlTableOrder,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const platformFilter: ServerPlatformFilter = urlPlatform ?? "all";
  const viewMode: ViewMode = urlView ?? "table";
  const { serverSort, setServerSort } = usePersistedServerSort(navigate, {
    sort: urlSortField,
    order: urlOrder,
  });

  const {
    data: serversData,
    isPending: serversPending,
    isFetching: serversFetching,
    error: serversError,
    refetch: refetchServers,
  } = useQuery({
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

  function handleRetryServers() {
    void refetchServers();
  }

  const setViewMode = useSearchParamNavigation<ViewMode>(
    navigate,
    "view",
    "table",
  );

  // Table sort — stored in URL search params
  const tableSortField: SortField = urlTableSort ?? "players";
  const tableSortDirection: SortDirection =
    urlTableOrder ?? (tableSortField === "name" ? "asc" : "desc");

  function handleTableSort(field: SortField) {
    let newDirection: SortDirection;
    if (field === tableSortField) {
      newDirection = tableSortDirection === "asc" ? "desc" : "asc";
    } else {
      newDirection = (
        [
          "players",
          "peak24h",
          "peakAllTime",
          "trend24h",
          "trend7d",
          "trend30d",
        ] as SortField[]
      ).includes(field)
        ? "desc"
        : "asc";
    }

    // Omit params when they match defaults (players + desc) to keep the URL clean
    const isDefault = field === "players" && newDirection === "desc";
    void navigate({
      search: (prev) => ({
        ...prev,
        tableSort: isDefault ? undefined : field,
        tableOrder: isDefault ? undefined : newDirection,
      }),
      replace: true,
      resetScroll: false,
    });
  }

  return (
    <>
      {showPageLoading ? (
        <DashboardLoadingSkeleton />
      ) : !globalSummary ? (
        <main className="dashboard-shell">
          <QueryErrorState
            title="Couldn't load the dashboard"
            description="Live player counts and peak history are unavailable."
            error={serversError}
            onRetry={handleRetryServers}
            isRetrying={serversFetching}
          />
        </main>
      ) : (
        <main className="dashboard-shell">
          <DashboardStatsRow summary={globalSummary} />

          <MetricChartsScope
            window={timeWindow}
            onZoomToRange={handleZoomToRange}
          >
            <HeroChartPanel
              hasServers={globalSummary.trackedServers > 0}
              window={timeWindow}
            />

            {pinnedServers.length > 0 ? (
              <Suspense fallback={null}>
                <PinnedServersGrid
                  servers={pinnedServers}
                  window={timeWindow}
                />
              </Suspense>
            ) : null}

            <ServerMetricsGrid
              servers={filteredServers}
              window={timeWindow}
              platformFilter={platformFilter}
              onPlatformFilterChange={setPlatformFilter}
              sort={serverSort}
              onSortChange={setServerSort}
              trackedServers={globalSummary.trackedServers}
              pinnedServerIds={pinnedServerIds}
              showPinButtons={isAuthenticated}
              viewToggle={
                <SegmentedControl
                  value={viewMode}
                  onValueChange={(v) => setViewMode(v)}
                  aria-label="View mode"
                  options={[
                    {
                      value: "cards",
                      shortLabel: "Cards",
                      mobileLabel: "Grid",
                      icon: Grid2x2,
                    },
                    {
                      value: "table",
                      shortLabel: "Table",
                      icon: Rows3,
                    },
                  ]}
                />
              }
              hideGridContent={viewMode === "table"}
            />

            <div className={viewMode === "cards" ? "hidden" : "-mt-4"}>
              <div className="servers-table-scroll scrollbar-hide">
                <div className="sm:min-w-[40rem]">
                  <ServersTable
                    servers={filteredServers}
                    pinnedServerIds={pinnedServerIds}
                    showPinButtons={isAuthenticated}
                    sortField={tableSortField}
                    sortDirection={tableSortDirection}
                    onSort={handleTableSort}
                    emptyMessage={
                      platformFilterEmptyCopy(platformFilter).emptyFiltered
                    }
                  />
                </div>
              </div>
            </div>
          </MetricChartsScope>
        </main>
      )}
    </>
  );
}
