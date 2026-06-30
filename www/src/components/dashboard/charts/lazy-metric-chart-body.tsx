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
  const hasData = chartData.timestamps.length > 0;
  const showChart = isVisible && (!isPending || hasData);
  const showLoading = isVisible && isPending;

  if (isError) {
    return (
      <div className="flex h-full items-center px-4">
        <p className="text-sm text-destructive">
          {DASHBOARD_CHART_ERROR_MESSAGE}
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {showChart ? (
        <MetricChartView
          def={chartDef}
          data={chartData}
          height={height}
          emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
          className="h-full"
          hydrateWhen={isVisible}
          {...DASHBOARD_CHART_PROPS}
        />
      ) : null}
      {showLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
          <LoadingState message="Loading…" />
        </div>
      ) : null}
    </div>
  );
}
