import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { AsnMetricsGrid } from "@/components/dashboard/grids/asn-metrics-grid";
import { DashboardTimeControls } from "@/components/dashboard/dashboard-time-controls";
import { DashboardRangeToggle } from "@/components/dashboard/dashboard-range-toggle";
import type { DashboardRangeOption } from "@/components/dashboard/dashboard-range-toggle";
import { DashboardStatsRow } from "@/components/dashboard/stats/dashboard-stats-row";
import { HeroChartPanel } from "@/components/dashboard/charts/hero-chart-panel";
import { ServerMetricsGrid } from "@/components/dashboard/grids/server-metrics-grid";
import { DashboardSearchInput } from "@/components/dashboard/dashboard-search-input";
import { LoadingState } from "@/components/loading-state";
import {
  SiteHeaderNav,
  SiteHeaderToolbar,
} from "@/components/site-header-toolbar";
import { useDashboardRefresh } from "@/lib/dashboard/use-dashboard-refresh";
import { asnsQueryOptions } from "@/lib/api/asns.queries";
import {
  filterServersByPlatform,
  parseServerPlatformFilterParam
  
} from "@/lib/api/servers";
import type {ServerPlatformFilter} from "@/lib/api/servers";
import { serversQueryOptions } from "@/lib/api/servers.queries";
import { pageTitle } from "@/lib/page-title";
import { DEFAULT_METRIC_TIME_RANGE } from "@/lib/metrics/range";
import type { MetricTimeRange } from "@/lib/metrics/range";
import {
  metricTimeWindowFromSearch,
  parseMetricTimeWindowSearch,
} from "@/lib/metrics/time-window";

type DashboardView = "server" | "asn";

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
};

function parseDashboardViewParam(value: unknown): DashboardView | undefined {
  if (value === "server" || value === "asn") {
    return value;
  }
  return undefined;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    ...parseMetricTimeWindowSearch(search),
    view: parseDashboardViewParam(search.view),
    platform: parseServerPlatformFilterParam(search.platform),
  }),
  loaderDeps: ({ search }) => ({
    view: search.view ?? "server",
  }),
  loader: ({ context: { queryClient }, deps: { view } }) =>
    view === "asn"
      ? queryClient.ensureQueryData(asnsQueryOptions())
      : queryClient.ensureQueryData(serversQueryOptions()),
  head: () => ({
    meta: [{ title: pageTitle("Dashboard") }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { refreshIntervalMs } = useDashboardRefresh();
  const {
    range: searchRange,
    from: searchFrom,
    to: searchTo,
    view: urlView,
    platform: urlPlatform,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const dashboardView = urlView ?? "server";
  const [searchInput, setSearchInput] = useState("");
  const platformFilter: ServerPlatformFilter = urlPlatform ?? "all";

  const { data: serversData, isPending: serversPending } = useQuery({
    ...serversQueryOptions(),
    enabled: dashboardView === "server",
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });
  const { data: asnsData, isPending: asnsPending } = useQuery({
    ...asnsQueryOptions(),
    enabled: dashboardView === "asn",
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
  const setDashboardView = useCallback(
    (view: DashboardView) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          view: view === "server" ? undefined : view,
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
  const filteredServers = useMemo(
    () => filterServersByPlatform(serversData?.servers ?? [], platformFilter),
    [platformFilter, serversData?.servers],
  );
  const activeData = dashboardView === "asn" ? asnsData : serversData;
  const activePending = dashboardView === "asn" ? asnsPending : serversPending;
  const showInitialLoading = activePending && !activeData;

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

      {showInitialLoading ? (
        <LoadingState message="Loading dashboard…" centered />
      ) : !activeData ? (
        <main className="dashboard-shell">
          <p className="text-destructive">Failed to load dashboard data.</p>
        </main>
      ) : (
        <main className="dashboard-shell">
          <DashboardStatsRow summary={activeData.summary} />

          <HeroChartPanel
            hasServers={activeData.summary.trackedServers > 0}
            window={timeWindow}
          />

          {dashboardView === "asn" ? (
            <AsnMetricsGrid
              asns={asnsData?.asns ?? []}
              window={timeWindow}
              trackedAsns={asnsData?.summary.trackedAsns ?? 0}
            />
          ) : (
            <ServerMetricsGrid
              servers={filteredServers}
              window={timeWindow}
              platformFilter={platformFilter}
              onPlatformFilterChange={setPlatformFilter}
              trackedServers={serversData?.summary.trackedServers ?? 0}
            />
          )}
        </main>
      )}
    </>
  );
}
