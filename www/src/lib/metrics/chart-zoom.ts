import { createContext } from "react";
import type uPlot from "uplot";

import { METRIC_WINDOW_MIN_SPAN_SECONDS } from "@/lib/metrics/window-policy";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { metricTimeWindowToEpochWindow } from "@/lib/metrics/time-window";

export type MetricsDataWindow = {
  from: number;
  to: number;
};

export type MetricsChartZoomContextValue = {
  window: MetricTimeWindow | null;
  getZoomContext: () => {
    window: MetricTimeWindow;
    dataWindow: MetricsDataWindow;
    onZoomToRange: (from: number, to: number) => void;
  } | null;
};

export const MetricsChartZoomContext =
  createContext<MetricsChartZoomContextValue | null>(null);

const ZOOM_IN_THRESHOLD = 0.95;
const MIN_SELECT_WIDTH_PX = 4;

function shouldNavigateChartZoom(
  from: number,
  to: number,
  dataWindow: MetricsDataWindow,
): boolean {
  const span = to - from;
  const dataSpan = dataWindow.to - dataWindow.from;

  if (dataSpan <= 0 || span <= 0) {
    return false;
  }

  if (span >= dataSpan * ZOOM_IN_THRESHOLD) {
    return false;
  }

  if (span < METRIC_WINDOW_MIN_SPAN_SECONDS) {
    return false;
  }

  return true;
}

/** X-axis bounds from the URL time selection (not API query metadata). */
export function resolveChartXWindow(
  window: MetricTimeWindow,
): MetricsDataWindow {
  if (window.kind === "custom") {
    const to = Math.min(window.to, Math.floor(Date.now() / 1000));
    return { from: window.from, to };
  }

  return metricTimeWindowToEpochWindow(window);
}

export function applyChartXWindow(
  chart: uPlot,
  xWindow: MetricsDataWindow,
): void {
  chart.setScale("x", { min: xWindow.from, max: xWindow.to });
}

function chartSelectionXRange(chart: uPlot): MetricsDataWindow | null {
  const { left, width } = chart.select;
  if (width < MIN_SELECT_WIDTH_PX) {
    return null;
  }

  const from = Math.floor(chart.posToVal(left, "x"));
  const to = Math.ceil(chart.posToVal(left + width, "x"));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
    return null;
  }

  return { from, to };
}

/**
 * Drag-select zoom via uPlot's setSelect hook (fires on mouseup with valid selection).
 * Requires `cursor.drag.setScale: false` so uPlot does not fight URL-locked x scales.
 */
export function createChartZoomSelectHook(
  getZoomContext: MetricsChartZoomContextValue["getZoomContext"],
): (chart: uPlot) => void {
  return (chart) => {
    const { width, height } = chart.select;
    if (width === 0 && height === 0) {
      return;
    }

    const selection = chartSelectionXRange(chart);
    chart.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);

    if (!selection) {
      return;
    }

    const ctx = getZoomContext();
    if (!ctx) {
      return;
    }

    if (
      !shouldNavigateChartZoom(selection.from, selection.to, ctx.dataWindow)
    ) {
      return;
    }

    ctx.onZoomToRange(selection.from, selection.to);
  };
}
