import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

import { ComparePlayersChart } from "@/components/compare/compare-players-chart";
import { CompareServersTable } from "@/components/compare/compare-servers-table";
import { FadeInAnimation } from "@/components/motion/fade-in-animation";
import { MetricChartsScope } from "@/components/metrics/metric-charts-scope";
import { SiteHeaderDashboard } from "@/components/site-header-dashboard";
import { useMetricTimeWindowControls } from "@/hooks/use-metric-time-window-controls";
import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import { serversCompareQueryOptions } from "@/lib/api/compare.queries";
import { comparePlatformWarning } from "@/lib/compare/platform-warning";
import {
  MIN_COMPARE_SERVERS,
  parseCompareIdsParam,
  serializeCompareIds,
} from "@/lib/compare/ids";
import { pageTitle } from "@/lib/page-title";
import {
  parseMetricTimeWindowSearch,
  type MetricTimeWindowSearch,
} from "@/lib/metrics/time-window";

type CompareSearch = MetricTimeWindowSearch & {
  ids?: string;
};

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): CompareSearch => ({
    ...parseMetricTimeWindowSearch(search),
    ids: typeof search.ids === "string" ? search.ids : undefined,
  }),
  head: () => ({
    meta: [{ title: pageTitle("Compare servers") }],
  }),
  component: ComparePage,
});

function ComparePage() {
  const {
    range: searchRange,
    from: searchFrom,
    to: searchTo,
    ids: idsParam,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const serverIds = useMemo(() => parseCompareIdsParam(idsParam), [idsParam]);

  const {
    timeWindow,
    setPresetTimeRange,
    setCustomTimeRange,
    handleZoomToRange,
  } = useMetricTimeWindowControls(
    { range: searchRange, from: searchFrom, to: searchTo },
    navigate,
  );

  const setServerIds = (ids: string[]) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ids: ids.length > 0 ? serializeCompareIds(ids) : undefined,
      }),
    });
  };

  const canCompare = serverIds.length >= MIN_COMPARE_SERVERS;

  const { data, isPending, isError } = useQuery({
    ...serversCompareQueryOptions(serverIds, timeWindow),
    enabled: canCompare,
  });

  const platformWarning = useMemo(
    () => comparePlatformWarning(data?.servers.map((item) => item.server) ?? []),
    [data?.servers],
  );

  return (
    <>
      <SiteHeaderDashboard
        window={timeWindow}
        onPresetChange={setPresetTimeRange}
        onCustomChange={setCustomTimeRange}
      />

      <main className="dashboard-shell compare-page">
        <Link
          to="/servers"
          search={timeWindowSearch}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to dashboard
        </Link>

        <FadeInAnimation>
          <CompareServersTable
            ids={serverIds}
            onIdsChange={setServerIds}
            compareData={data}
            compareLoading={canCompare && isPending}
          />
        </FadeInAnimation>

        {canCompare && isError ? (
          <p className="text-destructive">Failed to load compare chart.</p>
        ) : null}

        {canCompare && data && data.servers.length > 0 ? (
          <MetricChartsScope
            window={timeWindow}
            onZoomToRange={handleZoomToRange}
          >
            {platformWarning ? (
              <p className="text-sm text-muted-foreground">{platformWarning}</p>
            ) : null}

            <FadeInAnimation>
              <ComparePlayersChart
                servers={data.servers}
                window={timeWindow}
                from={data.from}
                to={data.to}
              />
            </FadeInAnimation>
          </MetricChartsScope>
        ) : null}
      </main>
    </>
  );
}
