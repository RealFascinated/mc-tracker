import type { MetricTimeSeries } from "@/lib/api/metric-timeseries";

export const EMPTY_METRIC_TIME_SERIES: MetricTimeSeries = {
  from: 0,
  to: 0,
  step: null,
  timestamps: [],
  series: {},
};

export const DASHBOARD_CARD_CHART_HEIGHT = 220;

export const DASHBOARD_CHART_PROPS = {
  hideHeader: true,
  showCurrentValues: false,
} as const;

export const DASHBOARD_CHART_EMPTY_MESSAGE = "No player history yet.";
export const DASHBOARD_CHART_ERROR_MESSAGE = "Failed to load history.";
