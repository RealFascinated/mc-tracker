import { apiFetch } from "@/lib/api/client";
import type {
  EntityPeakStats,
  PlayersSummaryBase,
  PlayersTimeseriesPayload,
} from "@/lib/api/types";
import { fetchList } from "@/lib/api/types";
import type { ServerListItem } from "@/lib/api/servers";

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

export type AsnDetailResponse = {
  asn: string;
  asnOrg: string;
  playersOnline: number;
  serverCount: number;
  peaks: EntityPeakStats;
  summary: PlayersSummaryBase & { trackedServers: number };
  servers: ServerListItem[];
};

export type AsnTimeseriesResponse = PlayersTimeseriesPayload & {
  asn: string;
  asnOrg: string;
};

export type AsnDetailSearch = {
  asnOrg?: string;
};

export function asnDetailSearch(asnOrg: string): AsnDetailSearch {
  const trimmed = asnOrg.trim();
  return trimmed.length > 0 ? { asnOrg: trimmed } : {};
}

export function asnDisplayName(asn: Pick<AsnListItem, "asn" | "asnOrg">): string {
  if (asn.asnOrg) {
    return asn.asnOrg;
  }
  if (asn.asn) {
    return asn.asn;
  }
  return "Unknown network";
}

export function getAsns(search?: string) {
  return fetchList<AsnsListResponse>("/asns", search);
}

export function getAsn(asn: string, asnOrg = "") {
  const params = new URLSearchParams();
  if (asnOrg) {
    params.set("asnOrg", asnOrg);
  }
  const query = params.toString();
  const path = query ? `/asns/${encodeURIComponent(asn)}?${query}` : `/asns/${encodeURIComponent(asn)}`;
  return apiFetch<AsnDetailResponse>(path, { credentials: "omit" });
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
