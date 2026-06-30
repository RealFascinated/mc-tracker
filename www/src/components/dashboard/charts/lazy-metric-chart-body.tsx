import { LoadingState } from "@/components/loading-state";
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
  isVisible: boolean;
  isPending: boolean;
  isError: boolean;
  chartDef: ChartDefinition;
  chartData: MetricTimeSeries;
  height?: number;
};

export function LazyMetricChartBody({
  isVisible,
  isPending,
  isError,
  chartDef,
  chartData,
  height = DASHBOARD_CARD_CHART_HEIGHT,
}: LazyMetricChartBodyProps) {
  if (isVisible && isPending) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height }}
      >
        <LoadingState message="Loading…" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="px-4 py-8 text-sm text-destructive">
        {DASHBOARD_CHART_ERROR_MESSAGE}
      </p>
    );
  }

  return (
    <MetricChartView
      def={chartDef}
      data={chartData}
      height={height}
      emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
      {...DASHBOARD_CHART_PROPS}
    />
  );
}
