import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AsnMetricsGrid } from "@/components/dashboard/grids/asn-metrics-grid";
import { DashboardTimeControls } from "@/components/dashboard/dashboard-time-controls";
import { DashboardRangeToggle } from "@/components/dashboard/dashboard-card";
import type { DashboardRangeOption } from "@/components/dashboard/dashboard-card";
import { DashboardStatsRow } from "@/components/dashboard/stats/dashboard-stats-row";
import type { DashboardView } from "@/components/dashboard/dashboard-search-input";
import { HeroChartPanel } from "@/components/dashboard/charts/hero-chart-panel";
import { ServerMetricsGrid } from "@/components/dashboard/grids/server-metrics-grid";
import { DashboardSearchInput } from "@/components/dashboard/dashboard-search-input";
import { LoadingState } from "@/components/loading-state";
import {
  SiteHeaderNav,
  SiteHeaderToolbar,
} from "@/components/site-header-toolbar";
import { useDashboardRefresh } from "@/lib/dashboard/refresh-context";
import { asnsQueryOptions } from "@/lib/api/asns.queries";
import { serversQueryOptions } from "@/lib/api/servers.queries";
import { pageTitle } from "@/lib/page-title";
import { DEFAULT_METRIC_TIME_RANGE } from "@/lib/metrics/range";
import type { MetricTimeRange } from "@/lib/metrics/range";
import {
  metricTimeWindowFromSearch,
  parseMetricTimeWindowSearch,
} from "@/lib/metrics/time-window";

const SEARCH_DEBOUNCE_MS = 300;

const DASHBOARD_VIEW_OPTIONS: Array<DashboardRangeOption<DashboardView>> = [
  { value: "server", shortLabel: "Servers", label: "Per server" },
  { value: "asn", shortLabel: "ASNs", label: "Per ASN" },
];

type DashboardSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
  search?: string;
  view?: DashboardView;
};

function parseDashboardSearchParam(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseDashboardViewParam(value: unknown): DashboardView | undefined {
  if (value === "server" || value === "asn") {
    return value;
  }
  return undefined;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    ...parseMetricTimeWindowSearch(search),
    search: parseDashboardSearchParam(search.search),
    view: parseDashboardViewParam(search.view),
  }),
  head: () => ({
    meta: [{ title: pageTitle("Dashboard") }],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(serversQueryOptions()),
      queryClient.ensureQueryData(asnsQueryOptions()),
    ]),
  component: DashboardPage,
});

function DashboardPage() {
  const { refreshIntervalMs } = useDashboardRefresh();
  const {
    range: searchRange,
    from: searchFrom,
    to: searchTo,
    search: urlSearch,
    view: urlView,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [searchInput, setSearchInput] = useState(urlSearch ?? "");
  const activeSearch = urlSearch?.trim() || undefined;
  const dashboardView = urlView ?? "server";

  useEffect(() => {
    setSearchInput(urlSearch ?? "");
  }, [urlSearch]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      const trimmed = searchInput.trim();
      const next = trimmed || undefined;
      if (next === activeSearch) {
        return;
      }

      void navigate({
        search: (prev) => ({ ...prev, search: next }),
        replace: true,
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => globalThis.clearTimeout(timer);
  }, [searchInput, activeSearch, navigate]);

  const serversQuery = useQuery({
    ...serversQueryOptions(activeSearch),
    enabled: dashboardView === "server",
    refetchInterval: refreshIntervalMs === false ? false : refreshIntervalMs,
  });
  const asnsQuery = useQuery({
    ...asnsQueryOptions(activeSearch),
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
      });
    },
    [navigate],
  );
  const activeQuery = dashboardView === "asn" ? asnsQuery : serversQuery;
  const showInitialLoading = activeQuery.isPending && !activeQuery.data;
  const isSearchLoading =
    activeQuery.isFetching &&
    activeQuery.isPlaceholderData &&
    !showInitialLoading;

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
        <DashboardSearchInput
          value={searchInput}
          onChange={setSearchInput}
          view={dashboardView}
        />
      </SiteHeaderToolbar>

      {showInitialLoading ? (
        <LoadingState message="Loading dashboard…" centered />
      ) : !activeQuery.data ? (
        <main className="dashboard-shell">
          <p className="text-destructive">Failed to load dashboard data.</p>
        </main>
      ) : (
        <main className="dashboard-shell">
          <DashboardStatsRow summary={activeQuery.data.summary} />

          <HeroChartPanel
            hasServers={activeQuery.data.summary.trackedServers > 0}
            window={timeWindow}
          />

          {dashboardView === "asn" ? (
            <AsnMetricsGrid
              asns={asnsQuery.data?.asns ?? []}
              window={timeWindow}
              hasActiveSearch={Boolean(activeSearch)}
              trackedAsns={asnsQuery.data?.summary.trackedAsns ?? 0}
              isLoading={isSearchLoading}
            />
          ) : (
            <ServerMetricsGrid
              servers={serversQuery.data?.servers ?? []}
              window={timeWindow}
              hasActiveSearch={Boolean(activeSearch)}
              trackedServers={serversQuery.data?.summary.trackedServers ?? 0}
              isLoading={isSearchLoading}
            />
          )}
        </main>
      )}
    </>
  );
}
