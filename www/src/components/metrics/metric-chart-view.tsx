import { useMemo, useRef } from "react";

import type { MetricTimeSeries } from "@/lib/api/metric-timeseries";
import type { ChartDefinition } from "@/lib/metrics/charts/types";
import { MetricChart } from "@/components/metrics/metric-chart";
import { MetricChartCard } from "@/components/metrics/metric-chart-card";
import { ChartEmpty } from "@/components/metrics/chart-empty";
import { buildChartConfig } from "@/lib/metrics/build-chart-config";
import { buildMultiSeriesData } from "@/lib/metrics/series";
import { cn } from "@/lib/utils";

type MetricChartViewProps = {
  def: ChartDefinition;
  data: MetricTimeSeries;
  className?: string;
  height?: number;
  hideHeader?: boolean;
  showCurrentValues?: boolean;
  emptyMessage?: string;
  variant?: "card" | "sparkline";
  xRange?: { min: number; max: number };
};

function MetricChartView({
  def,
  data,
  className,
  height,
  hideHeader,
  showCurrentValues,
  emptyMessage = "No data yet.",
  variant = "card",
  xRange,
}: MetricChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const config = useMemo(() => buildChartConfig(def, data), [def, data]);

  if (!config) {
    return (
      <ChartEmpty
        message={emptyMessage}
        className={className}
        minHeight={variant === "sparkline" ? 64 : (height ?? 220)}
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
          xRange={xRange}
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
        showCurrentValues={showCurrentValues}
      />
    </div>
  );
}

export { MetricChartView };
