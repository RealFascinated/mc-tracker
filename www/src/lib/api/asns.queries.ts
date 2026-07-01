import { queryOptions } from "@tanstack/react-query";

import { createListQueryOptions } from "@/lib/api/list-query";
import { getAsn, getAsnTimeseries, getAsns } from "@/lib/api/asns";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import {
  metricTimeWindowQueryKey,
  metricTimeWindowToEpochWindow,
} from "@/lib/metrics/time-window";

export const asnsQueryKey = ["asns", "list"] as const;

export const asnQueryKey = ["asns", "detail"] as const;

export const asnsTimeseriesQueryKey = ["asns", "timeseries"] as const;

export const asnsQueryOptions = createListQueryOptions({
  queryKey: asnsQueryKey,
  fetch: getAsns,
});

export function asnQueryOptions(asn: string, asnOrg: string) {
  return queryOptions({
    queryKey: [...asnQueryKey, asn, asnOrg] as const,
    queryFn: () => getAsn(asn, asnOrg),
    enabled: asn.length > 0,
  });
}

export function asnTimeseriesQueryOptions(
  asn: string,
  asnOrg: string,
  window: MetricTimeWindow,
) {
  return queryOptions({
    queryKey: [
      ...asnsTimeseriesQueryKey,
      asn,
      asnOrg,
      metricTimeWindowQueryKey(window),
    ] as const,
    queryFn: () => {
      const { from, to } = metricTimeWindowToEpochWindow(window);
      return getAsnTimeseries(asn, asnOrg, from, to);
    },
    enabled: asn.length > 0,
  });
}
