import { useMemo } from "react";
import type { ReactNode } from "react";

import { MetricsChartZoomContext } from "@/lib/metrics/chart-zoom";
import type {
  MetricsChartZoomContextValue,
  MetricsDataWindow,
} from "@/lib/metrics/chart-zoom";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type MetricsChartZoomProviderProps = {
  window: MetricTimeWindow;
  getDataWindow: () => MetricsDataWindow;
  onZoomToRange: (from: number, to: number) => void;
  disabled?: boolean;
  children: ReactNode;
};

export function MetricsChartZoomProvider({
  window,
  getDataWindow,
  onZoomToRange,
  disabled = false,
  children,
}: MetricsChartZoomProviderProps) {
  const value = useMemo<MetricsChartZoomContextValue>(
    () => ({
      window: disabled ? null : window,
      getZoomContext: () => {
        if (disabled) {
          return null;
        }

        return {
          window,
          dataWindow: getDataWindow(),
          onZoomToRange,
        };
      },
    }),
    [window, getDataWindow, onZoomToRange, disabled],
  );

  return (
    <MetricsChartZoomContext.Provider value={value}>
      {children}
    </MetricsChartZoomContext.Provider>
  );
}
