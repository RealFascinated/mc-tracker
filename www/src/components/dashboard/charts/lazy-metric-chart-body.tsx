import { LoadingState } from "@/components/loading-state";
import type { LazyMetricChartState } from "@/components/dashboard/charts/lazy-metric-chart-state";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import type { MetricTimeSeries } from "@/lib/api/metric-timeseries";
import type { ChartDefinition } from "@/lib/metrics/charts/types";
import {
  DASHBOARD_CARD_CHART_HEIGHT,
  DASHBOARD_CHART_EMPTY_MESSAGE,
  DASHBOARD_CHART_ERROR_MESSAGE,
  DASHBOARD_CHART_PROPS,
} from "@/lib/metrics/dashboard-chart-constants";

type LazyMetricChartBodyProps = {
  state: LazyMetricChartState;
  chartDef: ChartDefinition;
  chartData: MetricTimeSeries;
  hydrateWhen: boolean;
  height?: number;
};

export function LazyMetricChartBody({
  state,
  chartDef,
  chartData,
  hydrateWhen,
  height = DASHBOARD_CARD_CHART_HEIGHT,
}: LazyMetricChartBodyProps) {
  if (state.kind === "error") {
    return (
      <div className="flex h-full items-center px-4">
        <p className="text-sm text-destructive">
          {DASHBOARD_CHART_ERROR_MESSAGE}
        </p>
      </div>
    );
  }

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <div className="relative h-full min-h-0">
        <div className="h-full" aria-hidden />
        {state.kind === "loading" ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
            <LoadingState message="Loading…" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      <MetricChartView
        def={chartDef}
        data={chartData}
        height={height}
        emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
        className="h-full"
        hydrateWhen={hydrateWhen}
        {...DASHBOARD_CHART_PROPS}
      />
    </div>
  );
}
