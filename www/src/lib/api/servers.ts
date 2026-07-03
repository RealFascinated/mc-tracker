import { apiFetch } from "@/lib/api/client";
import type { ServerPlatform } from "@/lib/api/platform";
import type { ServerSort } from "@/lib/api/server-sort";
import type {
  EntityPeakStats,
  PlayersSummaryBase,
  TimeseriesResponse,
} from "@/lib/api/types";

export type ServersSummary = PlayersSummaryBase & {
  trackedServers: number;
};

export type ServerListItem = {
  id: string;
  name: string;
  type: ServerPlatform;
  host: string;
  port: number | null;
  asn: string;
  asnOrg: string;
  playersOnline: number | null;
  favicon: string | null;
  peaks: EntityPeakStats;
};

export type ServersListResponse = {
  summary: ServersSummary;
  servers: ServerListItem[];
};

export type ServerTimeseriesResponse = TimeseriesResponse & {
  id: string;
};

export type ServerSearchItem = {
  id: string;
  name: string;
  type: ServerPlatform;
  host: string;
  port: number | null;
  favicon: string | null;
  playersOnline: number | null;
};

export type ServersSearchResponse = {
  servers: ServerSearchItem[];
};

export function getServers(sort: ServerSort) {
  const params = new URLSearchParams({
    sort: sort.field,
    order: sort.order,
  });
  return apiFetch<ServersListResponse>(`/servers?${params}`, {
    credentials: "omit",
  });
}

export function getServer(id: string) {
  return apiFetch<ServerListItem>(`/servers/${id}`, { credentials: "omit" });
}

export function searchServers(search: string, limit = 10) {
  const params = new URLSearchParams({
    search,
    limit: String(limit),
  });
  return apiFetch<ServersSearchResponse>(`/servers/search?${params}`, {
    credentials: "omit",
  });
}

export function getServerTimeseries(id: string, from: number, to: number) {
  const params = new URLSearchParams({
    from: String(from),
    to: String(to),
  });
  return apiFetch<ServerTimeseriesResponse>(
    `/servers/${id}/timeseries?${params}`,
    { credentials: "omit" },
  );
}

export function getTotalTimeseries(from: number, to: number) {
  const params = new URLSearchParams({
    from: String(from),
    to: String(to),
  });
  return apiFetch<ServerTimeseriesResponse>(
    `/servers/timeseries/total?${params}`,
    { credentials: "omit" },
  );
}
