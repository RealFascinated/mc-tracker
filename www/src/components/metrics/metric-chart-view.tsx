import { useMemo, useRef } from "react";

import type { MetricTimeSeries } from "@/lib/api/metric-timeseries";
import type { ChartDefinition } from "@/lib/metrics/charts/types";
import { MetricChart } from "@/components/metrics/metric-chart";
import { MetricChartCard } from "@/components/metrics/metric-chart-card";
import { ChartEmpty } from "@/components/metrics/chart-empty";
import { buildChartConfig } from "@/lib/metrics/build-chart-config";
import { buildMultiSeriesData } from "@/lib/metrics/series";
import { cn } from "cnfast";

type MetricChartViewProps = {
  def: ChartDefinition;
  data: MetricTimeSeries;
  className?: string;
  height?: number;
  hideHeader?: boolean;
  hideLegend?: boolean;
  showCurrentValues?: boolean;
  flush?: boolean;
  emptyMessage?: string;
  variant?: "card" | "sparkline";
  hydrateWhen?: boolean;
};

function MetricChartView({
  def,
  data,
  className,
  height,
  hideHeader,
  hideLegend,
  showCurrentValues,
  flush,
  emptyMessage = "No data yet.",
  variant = "card",
  hydrateWhen,
}: MetricChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const config = useMemo(() => buildChartConfig(def, data), [def, data]);
  const queryWindow = useMemo(
    (): { from: number; to: number } | undefined =>
      data.from > 0 && data.to > data.from
        ? { from: data.from, to: data.to }
        : undefined,
    [data.from, data.to],
  );

  if (!config) {
    return (
      <ChartEmpty
        message={emptyMessage}
        className={className}
        height={variant === "sparkline" ? 64 : (height ?? 220)}
      />
    );
  }

  if (variant === "sparkline") {
    const built = buildMultiSeriesData(config.timestamps, config.series);
    if (!built) {
      return <div className={cn("h-16 bg-muted/40", className)} aria-hidden />;
    }

    const seriesAxisIds = built.sourceIndices.map(
      (index) => config.series[index]?.axis ?? "left",
    );

    return (
      <div ref={containerRef} className={cn("relative h-16", className)}>
        <MetricChart
          sizeRef={containerRef}
          data={built.data}
          labels={built.labels}
          chartAxes={config.axes}
          seriesAxisIds={seriesAxisIds}
          negated={built.negated}
          seriesRenders={built.renders}
          seriesFormatters={config.seriesFormatters}
          queryWindow={queryWindow}
          height={height ?? 64}
          showTooltip={false}
          compact
          hideYAxis
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <MetricChartCard
        config={config}
        height={height}
        hideHeader={hideHeader}
        hideLegend={hideLegend}
        showCurrentValues={showCurrentValues}
        flush={flush}
        hydrateWhen={hydrateWhen}
        queryWindow={queryWindow}
      />
    </div>
  );
}

export { MetricChartView };
