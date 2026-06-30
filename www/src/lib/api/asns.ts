import { apiFetch } from "@/lib/api/client";
import type {
  EntityPeakStats,
  PlayersSummaryBase,
  PlayersTimeseriesPayload,
} from "@/lib/api/types";
import { fetchList } from "@/lib/api/types";

export type AsnsSummary = PlayersSummaryBase & {
  trackedAsns: number;
  trackedServers: number;
};

export type AsnListItem = {
  asn: string;
  asnOrg: string;
  playersOnline: number;
  serverCount: number;
  peaks: EntityPeakStats;
};

export type AsnsListResponse = {
  summary: AsnsSummary;
  asns: AsnListItem[];
};

export type AsnTimeseriesResponse = PlayersTimeseriesPayload & {
  asn: string;
  asnOrg: string;
};

export function getAsns(search?: string) {
  return fetchList<AsnsListResponse>("/asns", search);
}

export function getAsnTimeseries(
  asn: string,
  asnOrg: string,
  from: number,
  to: number,
) {
  const params = new URLSearchParams({
    asn,
    from: String(from),
    to: String(to),
  });
  if (asnOrg) {
    params.set("asnOrg", asnOrg);
  }
  return apiFetch<AsnTimeseriesResponse>(`/asns/timeseries?${params}`, {
    credentials: "omit",
  });
}

export function asnListKey(asn: AsnListItem): string {
  return `${asn.asn}\u0000${asn.asnOrg}`;
}
