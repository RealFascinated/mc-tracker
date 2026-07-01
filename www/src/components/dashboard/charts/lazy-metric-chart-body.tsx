import type { ReactNode } from "react";

import { LoadingState } from "@/components/loading-state";
import { ChartEmpty } from "@/components/metrics/chart-empty";
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
import { cn } from "@/lib/utils";

type LazyMetricChartBodyProps = {
  state: LazyMetricChartState;
  chartDef: ChartDefinition;
  chartData: MetricTimeSeries;
  hydrateWhen: boolean;
  height?: number;
};

function LazyMetricChartOverlay({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative h-full min-h-0">
      <div className="h-full" aria-hidden />
      <div
        className={cn(
          "absolute inset-0 z-10 flex items-center justify-center",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function LazyMetricChartBody({
  state,
  chartDef,
  chartData,
  hydrateWhen,
  height = DASHBOARD_CARD_CHART_HEIGHT,
}: LazyMetricChartBodyProps) {
  if (state.kind === "error") {
    return (
      <ChartEmpty
        message={DASHBOARD_CHART_ERROR_MESSAGE}
        height={height}
        className="text-sm text-destructive"
      />
    );
  }

  if (state.kind === "idle") {
    return (
      <div className="relative h-full min-h-0">
        <div className="h-full" aria-hidden />
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <LazyMetricChartOverlay className="bg-card/80">
        <LoadingState message="Loading…" />
      </LazyMetricChartOverlay>
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
