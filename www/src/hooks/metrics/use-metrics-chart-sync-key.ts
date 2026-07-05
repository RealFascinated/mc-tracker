import { use } from "react";

import { MetricsChartSyncContext } from "@/lib/metrics/chart-sync";

export function useMetricsChartSyncKey() {
  return use(MetricsChartSyncContext);
}
