import { useRouterState } from "@tanstack/react-router";

import {
  metricTimeWindowSearchParams,
  parseMetricTimeWindowSearch
  
} from "@/lib/metrics/time-window";
import type {MetricTimeWindowSearch} from "@/lib/metrics/time-window";

export function useMetricTimeWindowLinkSearch(): MetricTimeWindowSearch {
  return useRouterState({
    select: (state) =>
      metricTimeWindowSearchParams(
        parseMetricTimeWindowSearch(
          state.location.search as Record<string, unknown>,
        ),
      ),
  });
}
