import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { AsnMetricsGrid } from "@/components/dashboard/grids/asn-metrics-grid";
import { AsnSortToggle } from "@/components/dashboard/server/asn-sort-toggle";
import { DashboardStatsRow } from "@/components/dashboard/stats/dashboard-stats-row";
import { HeroChartPanel } from "@/components/dashboard/charts/hero-chart-panel";
import {
  DashboardLoadingSkeleton,
  GridSkeleton,
} from "@/components/dashboard/dashboard-loading-skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import { useMetricTimeWindowControls } from "@/hooks/metrics/use-metric-time-window-controls";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import { asnsQueryOptions } from "@/lib/api/asns.queries";
import { serversQueryOptions } from "@/lib/api/servers.queries";
import {
  asnSortToSearchParams,
  parseAsnSortFieldParam,
  resolveAsnSort,
  sortAsnsBy,
} from "@/lib/api/asn-sort";
import type { AsnSort, AsnSortField } from "@/lib/api/asn-sort";
import type { SortOrder } from "@/lib/api/server-sort";
import { parseSortOrderParam } from "@/lib/api/server-sort";
import { pageTitle } from "@/lib/page-title";
import type { MetricTimeRange } from "@/lib/metrics/range";
import { parseMetricTimeWindowSearch } from "@/lib/metrics/time-window";

type AsnsSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
  sort?: AsnSortField;
  order?: SortOrder;
};

export const Route = createFileRoute("/asns/")({
  validateSearch: (search: Record<string, unknown>): AsnsSearch => ({
    ...parseMetricTimeWindowSearch(search),
    sort: parseAsnSortFieldParam(search.sort),
    order: parseSortOrderParam(search.order),
  }),
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(serversQueryOptions()),
      queryClient.ensureQueryData(asnsQueryOptions()),
    ]);
  },
  head: () => ({
    meta: [{ title: pageTitle("ASNs") }],
  }),
  component: AsnsPage,
});

function AsnsPage() {
  const { refreshIntervalMs } = useDashboardRefresh();
  const {
    range: searchRange,
    from: searchFrom,
    to: searchTo,
    sort: urlSort,
    order: urlOrder,
  } = Route.useSearch();
  const navigate = Route.useNavigate();

  const {
    data: serversData,
    isPending: serversPending,
    isFetching: serversFetching,
    error: serversError,
    refetch: refetchServers,
  } = useQuery({
    ...serversQueryOptions(),
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });
  const {
    data: asnsData,
    isFetching: asnsFetching,
    error: asnsError,
    refetch: refetchAsns,
  } = useQuery({
    ...asnsQueryOptions(),
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });

  const asnSort = useMemo(
    () => resolveAsnSort({ sort: urlSort, order: urlOrder }),
    [urlOrder, urlSort],
  );
  const sortedAsns = useMemo(
    () => sortAsnsBy(asnsData?.asns ?? [], asnSort),
    [asnSort, asnsData?.asns],
  );
  const setAsnSort = useCallback(
    (sort: AsnSort) => {
      const params = asnSortToSearchParams(sort);
      void navigate({
        search: (prev) => ({
          ...prev,
          sort: params.sort,
          order: params.order,
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

  const { timeWindow, handleZoomToRange } = useMetricTimeWindowControls(
    { range: searchRange, from: searchFrom, to: searchTo },
    navigate,
  );

  const globalSummary = serversData?.summary;
  const showPageLoading = serversPending && !globalSummary;

  function handleRetrySummary() {
    void refetchServers();
  }

  function handleRetryAsns() {
    void refetchAsns();
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
            onRetry={handleRetrySummary}
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

            {!asnsData ? (
              asnsError ? (
                <QueryErrorState
                  title="Couldn't load network groupings"
                  description="The totals above are still live."
                  error={asnsError}
                  onRetry={handleRetryAsns}
                  isRetrying={asnsFetching}
                />
              ) : (
                <GridSkeleton />
              )
            ) : (
              <AsnMetricsGrid
                asns={sortedAsns}
                window={timeWindow}
                trackedAsns={asnsData.summary.trackedAsns}
                headerTrailing={
                  <AsnSortToggle value={asnSort} onValueChange={setAsnSort} />
                }
              />
            )}
          </MetricChartsScope>
        </main>
      )}
    </>
  );
}
