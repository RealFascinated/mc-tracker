import { apiFetch } from "@/lib/api/client";
import type {
  AsnTimeseriesSummaryResponse,
  ServerTimeseriesSummaryResponse,
  TimeseriesSummaryResponse,
} from "@/lib/api/types";

export function getServerTimeseriesSummary(
  id: string,
  from: string,
  to: string,
): Promise<ServerTimeseriesSummaryResponse> {
  const params = new URLSearchParams({ from, to });
  return apiFetch<ServerTimeseriesSummaryResponse>(
    `/servers/${id}/timeseries/summary?${params}`,
    { credentials: "omit" },
  );
}

export function getTotalTimeseriesSummary(
  from: string,
  to: string,
): Promise<TimeseriesSummaryResponse> {
  const params = new URLSearchParams({ from, to });
  return apiFetch<TimeseriesSummaryResponse>(
    `/servers/timeseries/total/summary?${params}`,
    { credentials: "omit" },
  );
}

export function getAsnTimeseriesSummary(
  asn: string,
  from: string,
  to: string,
  asnOrg?: string,
): Promise<AsnTimeseriesSummaryResponse> {
  const params = new URLSearchParams({ from, to, asn });
  if (asnOrg) {
    params.set("asnOrg", asnOrg);
  }
  return apiFetch<AsnTimeseriesSummaryResponse>(
    `/asns/timeseries/summary?${params}`,
    { credentials: "omit" },
  );
}
