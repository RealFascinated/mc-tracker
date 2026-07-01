import { createContext, useContext, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type uPlot from "uplot";

import { METRIC_WINDOW_MIN_SPAN_SECONDS } from "@/lib/metrics/window-policy";

export type MetricsDataWindow = {
  from: number;
  to: number;
};

const ZOOM_IN_THRESHOLD = 0.95;

export function shouldNavigateChartZoom(
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

type MetricsChartZoomContextValue = {
  getZoomContext: () => {
    dataWindow: MetricsDataWindow;
    onZoomToRange: (from: number, to: number) => void;
  } | null;
};

const MetricsChartZoomContext =
  createContext<MetricsChartZoomContextValue | null>(null);

type MetricsChartZoomProviderProps = {
  dataWindow: MetricsDataWindow;
  onZoomToRange: (from: number, to: number) => void;
  disabled?: boolean;
  children: ReactNode;
};

function MetricsChartZoomProvider({
  dataWindow,
  onZoomToRange,
  disabled = false,
  children,
}: MetricsChartZoomProviderProps) {
  const stateRef = useRef({ dataWindow, onZoomToRange, disabled });
  stateRef.current = { dataWindow, onZoomToRange, disabled };

  const value = useMemo<MetricsChartZoomContextValue>(
    () => ({
      getZoomContext: () => {
        const state = stateRef.current;
        if (state.disabled) {
          return null;
        }

        return {
          dataWindow: state.dataWindow,
          onZoomToRange: state.onZoomToRange,
        };
      },
    }),
    [],
  );

  return (
    <MetricsChartZoomContext.Provider value={value}>
      {children}
    </MetricsChartZoomContext.Provider>
  );
}

function useMetricsChartZoom() {
  return useContext(MetricsChartZoomContext);
}

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

export { MetricsChartZoomProvider, useMetricsChartZoom };
