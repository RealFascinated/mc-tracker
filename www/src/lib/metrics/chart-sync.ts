import { createContext } from "react";
import uPlot from "uplot";

export const MetricsChartSyncContext = createContext<string | null>(null);

export function registerMetricsChartSync(syncKey: string, chart: uPlot) {
  uPlot.sync(syncKey).sub(chart);
}

export function unregisterMetricsChartSync(syncKey: string, chart: uPlot) {
  uPlot.sync(syncKey).unsub(chart);
}
