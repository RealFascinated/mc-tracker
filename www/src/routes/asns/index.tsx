import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AsnMetricsGrid } from "@/components/dashboard/grids/asn-metrics-grid";
import { DashboardStatsRow } from "@/components/dashboard/stats/dashboard-stats-row";
import { HeroChartPanel } from "@/components/dashboard/charts/hero-chart-panel";
import { LoadingState } from "@/components/loading-state";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import { SiteHeaderDashboard } from "@/components/site-header-dashboard";
import { useMetricTimeWindowControls } from "@/hooks/use-metric-time-window-controls";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import { asnsQueryOptions } from "@/lib/api/asns.queries";
import { serversQueryOptions } from "@/lib/api/servers.queries";
import { pageTitle } from "@/lib/page-title";
import type { MetricTimeRange } from "@/lib/metrics/range";
import { parseMetricTimeWindowSearch } from "@/lib/metrics/time-window";

type AsnsSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
};

export const Route = createFileRoute("/asns/")({
  validateSearch: (search: Record<string, unknown>): AsnsSearch =>
    parseMetricTimeWindowSearch(search),
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
  } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data: serversData, isPending: serversPending } = useQuery({
    ...serversQueryOptions(),
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });
  const { data: asnsData, isPending: asnsPending } = useQuery({
    ...asnsQueryOptions(),
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

  const globalSummary = serversData?.summary;
  const showPageLoading = serversPending && !globalSummary;

  return (
    <>
      <SiteHeaderDashboard
        window={timeWindow}
        onPresetChange={setPresetTimeRange}
        onCustomChange={setCustomTimeRange}
      />

      {showPageLoading ? (
        <LoadingState message="Loading dashboard…" centered />
      ) : !globalSummary && !asnsData ? (
        <main className="dashboard-shell">
          <p className="text-destructive">Failed to load dashboard data.</p>
        </main>
      ) : (
        <main className="dashboard-shell">
          {globalSummary ? <DashboardStatsRow summary={globalSummary} /> : null}

          {asnsPending && !asnsData ? (
            <LoadingState message="Loading networks…" centered />
          ) : !asnsData ? (
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

              <AsnMetricsGrid
                asns={asnsData.asns}
                window={timeWindow}
                trackedAsns={asnsData.summary.trackedAsns}
              />
            </MetricChartsScope>
          )}
        </main>
      )}
    </>
  );
}
