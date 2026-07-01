import { useMemo, useRef } from "react";
import type { ReactNode } from "react";

import {
  MetricsChartZoomContext
  
  
} from "@/lib/metrics/chart-zoom";
import type {MetricsChartZoomContextValue, MetricsDataWindow} from "@/lib/metrics/chart-zoom";

type MetricsChartZoomProviderProps = {
  dataWindow: MetricsDataWindow;
  onZoomToRange: (from: number, to: number) => void;
  disabled?: boolean;
  children: ReactNode;
};

export function MetricsChartZoomProvider({
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
