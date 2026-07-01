import { createContext, useContext, useId, useMemo } from "react";
import type { ReactNode } from "react";
import uPlot from "uplot";

const MetricsChartSyncContext = createContext<string | null>(null);

function MetricsChartSyncProvider({ children }: { children: ReactNode }) {
  const id = useId();
  const syncKey = useMemo(() => uPlot.sync(`metrics-${id}`).key, [id]);

  return (
    <MetricsChartSyncContext.Provider value={syncKey}>
      {children}
    </MetricsChartSyncContext.Provider>
  );
}

function useMetricsChartSyncKey() {
  return useContext(MetricsChartSyncContext);
}

function registerMetricsChartSync(syncKey: string, chart: uPlot) {
  uPlot.sync(syncKey).sub(chart);
}

function unregisterMetricsChartSync(syncKey: string, chart: uPlot) {
  uPlot.sync(syncKey).unsub(chart);
}

function createChartZoomSyncHook(syncKey: string) {
  return (chart: uPlot, scaleKey: string) => {
    if (scaleKey !== "x") {
      return;
    }

    const { min, max } = chart.scales.x;
    if (min == null || max == null) {
      return;
    }

    for (const plot of uPlot.sync(syncKey).plots) {
      if (plot === chart) {
        continue;
      }

      const other = plot.scales.x;
      if (other.min === min && other.max === max) {
        continue;
      }

      plot.setScale("x", { min, max });
    }
  };
}

export {
  createChartZoomSyncHook,
  MetricsChartSyncProvider,
  registerMetricsChartSync,
  unregisterMetricsChartSync,
  useMetricsChartSyncKey,
};
