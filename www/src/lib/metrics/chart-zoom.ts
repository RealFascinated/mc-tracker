import { createContext } from "react";
import type uPlot from "uplot";

import { METRIC_WINDOW_MIN_SPAN_SECONDS } from "@/lib/metrics/window-policy";

export type MetricsDataWindow = {
  from: number;
  to: number;
};

const ZOOM_IN_THRESHOLD = 0.95;

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

export type MetricsChartZoomContextValue = {
  getZoomContext: () => {
    dataWindow: MetricsDataWindow;
    onZoomToRange: (from: number, to: number) => void;
  } | null;
};

export const MetricsChartZoomContext =
  createContext<MetricsChartZoomContextValue | null>(null);

export function bindChartZoomNavigate(
  chart: uPlot,
  getZoomContext: MetricsChartZoomContextValue["getZoomContext"],
): () => void {
  let selecting = false;

  const onMouseDown = () => {
    selecting = true;
  };

  const onMouseUp = () => {
    if (!selecting) {
      return;
    }

    selecting = false;

    requestAnimationFrame(() => {
      const ctx = getZoomContext();
      if (!ctx) {
        return;
      }

      const { min, max } = chart.scales.x;
      if (min == null || max == null) {
        return;
      }

      const from = Math.floor(min);
      const to = Math.ceil(max);

      if (!shouldNavigateChartZoom(from, to, ctx.dataWindow)) {
        return;
      }

      ctx.onZoomToRange(from, to);
    });
  };

  chart.over.addEventListener("mousedown", onMouseDown);
  chart.over.addEventListener("mouseup", onMouseUp);

  return () => {
    chart.over.removeEventListener("mousedown", onMouseDown);
    chart.over.removeEventListener("mouseup", onMouseUp);
  };
}
