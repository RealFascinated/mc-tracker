import { createContext, use } from "react";
import uPlot from "uplot";

export const MetricsChartSyncContext = createContext<string | null>(null);

export function useMetricsChartSyncKey() {
  return use(MetricsChartSyncContext);
}

export function registerMetricsChartSync(syncKey: string, chart: uPlot) {
  uPlot.sync(syncKey).sub(chart);
}

export function unregisterMetricsChartSync(syncKey: string, chart: uPlot) {
  uPlot.sync(syncKey).unsub(chart);
}

export function createChartZoomSyncHook(syncKey: string) {
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
