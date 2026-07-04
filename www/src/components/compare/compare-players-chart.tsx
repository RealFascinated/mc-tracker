import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardCardHeader } from "@/components/dashboard/dashboard-card-header";
import { DashboardRangeToggle } from "@/components/dashboard/dashboard-range-toggle";
import { LoadingState } from "@/components/loading-state";
import { ChartEmpty } from "@/components/metrics/chart-empty";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import type { ServersCompareItem } from "@/lib/api/compare";
import { totalTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import {
  appendTotalTimeseries,
  buildCompareChartDefinition,
  compareSeriesToMetricTimeSeries,
  indexMetricTimeSeries,
} from "@/lib/compare/summary-to-metric";
import { DASHBOARD_CHART_EMPTY_MESSAGE } from "@/lib/metrics/dashboard-chart-constants";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type ChartScale = "absolute" | "indexed";

type ComparePlayersChartProps = {
  servers: ServersCompareItem[];
  window: MetricTimeWindow;
  from: number;
  to: number;
  height?: number;
};

export function ComparePlayersChart({
  servers,
  window,
  from,
  to,
  height = 360,
}: ComparePlayersChartProps) {
  const [scale, setScale] = useState<ChartScale>("absolute");
  const [showTotal, setShowTotal] = useState(false);

  const { data: totalTimeseries, isPending: totalPending } = useQuery({
    ...totalTimeseriesQueryOptions(window),
    enabled: showTotal,
  });

  const seriesInput = useMemo(
    () =>
      servers.map((item) => ({
        key: `server_${item.server.id}`,
        label: item.server.name,
        points: item.summary.points,
      })),
    [servers],
  );

  const chart = useMemo(() => {
    let data = compareSeriesToMetricTimeSeries(seriesInput, from, to);
    if (!data) {
      return null;
    }

    if (showTotal && totalTimeseries) {
      data = appendTotalTimeseries(data, totalTimeseries);
    }

    if (scale === "indexed") {
      data = indexMetricTimeSeries(data);
    }

    const def = buildCompareChartDefinition(seriesInput, {
      id: "compare-players",
      indexed: scale === "indexed",
      includeTotal: showTotal && totalTimeseries != null,
    });

    return { data, def };
  }, [
    seriesInput,
    from,
    to,
    showTotal,
    totalTimeseries,
    scale,
  ]);

  const showTotalLoading = showTotal && totalPending && !totalTimeseries;

  return (
    <DashboardCard className="hero-chart-panel">
      <DashboardCardHeader
        title="Player history"
        trailingAction={
          <div className="flex flex-wrap items-center gap-2">
            <DashboardRangeToggle
              value={scale}
              options={[
                { value: "absolute", shortLabel: "Absolute" },
                { value: "indexed", shortLabel: "Indexed" },
              ]}
              onValueChange={setScale}
              aria-label="Chart scale"
            />
            <DashboardRangeToggle
              value={showTotal ? "on" : "off"}
              options={[
                { value: "off", shortLabel: "Servers only" },
                { value: "on", shortLabel: "+ Total" },
              ]}
              onValueChange={(value) => setShowTotal(value === "on")}
              aria-label="Total baseline"
            />
          </div>
        }
      />
      <div className="relative">
        {chart ? (
          <MetricChartView
            def={chart.def}
            data={chart.data}
            height={height}
            hideHeader
            emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
            flush
          />
        ) : (
          <ChartEmpty message={DASHBOARD_CHART_EMPTY_MESSAGE} height={height} />
        )}
        {showTotalLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
            <LoadingState message="Loading total baseline…" />
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}
