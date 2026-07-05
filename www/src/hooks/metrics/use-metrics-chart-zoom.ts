import { use } from "react";

import { MetricsChartZoomContext } from "@/lib/metrics/chart-zoom";

export function useMetricsChartZoom() {
  return use(MetricsChartZoomContext);
}
