import { LoadingState } from "@/components/loading-state";
import { MetricChartView } from "@/components/metrics/metric-chart-view";
import type { MetricTimeSeries } from "@/lib/api/metric-timeseries";
import type { ChartDefinition } from "@/lib/metrics/charts/types";
import { EMPTY_METRIC_TIME_SERIES } from "@/lib/api/metric-timeseries";
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
  const reserveChart = isVisible || hasData;
  const showLoading = isVisible && isPending && !hasData;

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
    <div className="relative h-full min-h-0">
      {reserveChart ? (
        <MetricChartView
          def={chartDef}
          data={hasData ? chartData : EMPTY_METRIC_TIME_SERIES}
          height={height}
          emptyMessage={DASHBOARD_CHART_EMPTY_MESSAGE}
          className="h-full"
          hydrateWhen={reserveChart}
          {...DASHBOARD_CHART_PROPS}
        />
      ) : (
        <div className="h-full" aria-hidden />
      )}
      {showLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
          <LoadingState message="Loading…" />
        </div>
      ) : null}
    </div>
  );
}
