import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { AsnMetricsGrid } from "@/components/dashboard/grids/asn-metrics-grid";
import { AsnSortToggle } from "@/components/dashboard/server/asn-sort-toggle";
import { DashboardStatsRow } from "@/components/dashboard/stats/dashboard-stats-row";
import { HeroChartPanel } from "@/components/dashboard/charts/hero-chart-panel";
import { LoadingState } from "@/components/loading-state";
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

  const { data: serversData, isPending: serversPending } = useQuery({
    ...serversQueryOptions(),
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });
  const { data: asnsData } = useQuery({
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

  return (
    <>
      {showPageLoading ? (
        <LoadingState message="Loading dashboard…" centered />
      ) : !globalSummary && !asnsData ? (
        <main className="dashboard-shell">
          <p className="text-destructive">Failed to load dashboard data.</p>
        </main>
      ) : (
        <main className="dashboard-shell">
          {globalSummary ? <DashboardStatsRow summary={globalSummary} /> : null}

          {!asnsData ? (
            <LoadingState message="Loading networks…" centered />
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

              <AsnMetricsGrid
                asns={sortedAsns}
                window={timeWindow}
                trackedAsns={asnsData.summary.trackedAsns}
                headerTrailing={
                  <AsnSortToggle value={asnSort} onValueChange={setAsnSort} />
                }
              />
            </MetricChartsScope>
          )}
        </main>
      )}
    </>
  );
}
