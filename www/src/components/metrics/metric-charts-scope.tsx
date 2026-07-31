import { useCallback } from "react";
import type { ReactNode } from "react";

import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import { MetricsChartSyncProvider } from "@/lib/metrics/metrics-chart-sync-provider";
import { MetricsChartZoomProvider } from "@/lib/metrics/metrics-chart-zoom-provider";
import type { MetricsDataWindow } from "@/lib/metrics/chart-zoom";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { metricTimeWindowToEpochWindow } from "@/lib/metrics/time-window";

type MetricChartsScopeProps = {
  window: MetricTimeWindow;
  onZoomToRange: (from: number, to: number) => void;
  zoomDisabled?: boolean;
  children: ReactNode;
};

export function MetricChartsScope({
  window,
  onZoomToRange,
  zoomDisabled = false,
  children,
}: MetricChartsScopeProps) {
  const { getEpochAnchor } = useDashboardRefresh();
  const getDataWindow = useCallback(
    (): MetricsDataWindow =>
      metricTimeWindowToEpochWindow(window, getEpochAnchor()),
    [window, getEpochAnchor],
  );

  return (
    <MetricsChartZoomProvider
      window={window}
      getDataWindow={getDataWindow}
      onZoomToRange={onZoomToRange}
      disabled={zoomDisabled}
    >
      <MetricsChartSyncProvider>{children}</MetricsChartSyncProvider>
    </MetricsChartZoomProvider>
  );
}
