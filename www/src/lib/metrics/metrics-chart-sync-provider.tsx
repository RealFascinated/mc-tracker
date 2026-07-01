import { useId, useMemo } from "react";
import type { ReactNode } from "react";
import uPlot from "uplot";

import { MetricsChartSyncContext } from "@/lib/metrics/chart-sync";

export function MetricsChartSyncProvider({
  children,
}: {
  children: ReactNode;
}) {
  const id = useId();
  const syncKey = useMemo(() => uPlot.sync(`metrics-${id}`).key, [id]);

  return (
    <MetricsChartSyncContext.Provider value={syncKey}>
      {children}
    </MetricsChartSyncContext.Provider>
  );
}
