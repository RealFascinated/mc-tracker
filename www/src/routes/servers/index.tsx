import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Grid2x2, Plus, Rows3 } from "lucide-react";
import { useMemo, useState } from "react";

import { PinnedServersGrid } from "@/components/dashboard/grids/pinned-servers-grid";
import { DashboardStatsRow } from "@/components/dashboard/stats/dashboard-stats-row";
import { HeroChartPanel } from "@/components/dashboard/charts/hero-chart-panel";
import { ServerMetricsGrid } from "@/components/dashboard/grids/server-metrics-grid";
import { SuggestServerDialog } from "@/components/dashboard/suggest-server-dialog";
import { ServersTable } from "@/components/dashboard/tables/servers-table";
import type {
  SortField,
  SortDirection,
} from "@/components/dashboard/tables/servers-table";
import { LoadingState } from "@/components/loading-state";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMetricTimeWindowControls } from "@/hooks/metrics/use-metric-time-window-controls";
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
import { Button } from "@/components/ui/button";
import type { MetricTimeRange } from "@/lib/metrics/range";
import { parseMetricTimeWindowSearch } from "@/lib/metrics/time-window";

type ViewMode = "cards" | "table";

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
    view: search.view === "table" ? "table" : undefined,
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
  const [suggestOpen, setSuggestOpen] = useState(false);
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
  const viewMode: ViewMode = urlView ?? "cards";
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

  const setViewMode = useSearchParamNavigation<ViewMode>(
    navigate,
    "view",
    "cards",
  );

  // Table sort — stored in URL search params
  const tableSortField: SortField = urlTableSort ?? "name";
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

    // Omit params when they match defaults (name + asc) to keep the URL clean
    const isDefault = field === "name" && newDirection === "asc";
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

            {viewMode === "cards" && pinnedServers.length > 0 ? (
              <PinnedServersGrid servers={pinnedServers} window={timeWindow} />
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
              viewToggle={
                <div className="flex items-center gap-2">
                  <Button
                    variant="highlighted"
                    size="sm"
                    className="rounded-snug"
                    data-icon-inline-start
                    onClick={() => {
                      if (!isAuthenticated) {
                        void navigate({ to: "/login" });
                        return;
                      }
                      setSuggestOpen(true);
                    }}
                  >
                    <Plus />
                    Suggest a server
                  </Button>
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
                </div>
              }
              hideGridContent={viewMode === "table"}
            />

            <div className={viewMode === "cards" ? "hidden" : "-mt-2"}>
              <div className="servers-table-scroll scrollbar-hide">
                <div className="min-w-[40rem]">
                  <ServersTable
                    servers={filteredServers}
                    pinnedServerIds={pinnedServerIds}
                    showPinButtons={isAuthenticated}
                    sortField={tableSortField}
                    sortDirection={tableSortDirection}
                    onSort={handleTableSort}
                  />
                </div>
              </div>
            </div>
          </MetricChartsScope>
        </main>
      )}

      <SuggestServerDialog open={suggestOpen} onOpenChange={setSuggestOpen} />
    </>
  );
}
