import { apiFetch } from "@/lib/api/client";
import type { ServerListItem } from "@/lib/api/servers";
import type { PartialError, TimeseriesSummaryResponse } from "@/lib/api/types";
import { MAX_METRIC_POINTS } from "@/lib/metrics/max-points";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { metricTimeWindowToSummaryBounds } from "@/lib/metrics/time-window";

export type ServersCompareItem = {
  server: ServerListItem;
  summary: TimeseriesSummaryResponse;
};

export type ServersCompareResponse = {
  from: number;
  to: number;
  servers: ServersCompareItem[];
  errors: PartialError[];
};

export function getServersCompareSummary(
  ids: string[],
  window: MetricTimeWindow,
  maxPoints = MAX_METRIC_POINTS,
) {
  const { from, to } = metricTimeWindowToSummaryBounds(window);
  const params = new URLSearchParams({
    ids: ids.join(","),
    from,
    to,
    maxPoints: String(maxPoints),
  });
  return apiFetch<ServersCompareResponse>(
    `/servers/compare/summary?${params}`,
    { credentials: "omit" },
  );
}
