import { apiFetch } from "@/lib/api/client";
import type { ServerListItem } from "@/lib/api/servers";

export type PinnedServersListResponse = {
  servers: ServerListItem[];
};

export function getPinnedServers() {
  return apiFetch<PinnedServersListResponse>("/pinned-servers");
}

export function pinServer(serverId: string) {
  return apiFetch<PinnedServersListResponse>("/pinned-servers", {
    method: "POST",
    body: JSON.stringify({ serverId }),
  });
}

export function unpinServer(serverId: string) {
  return apiFetch<PinnedServersListResponse>(`/pinned-servers/${serverId}`, {
    method: "DELETE",
  });
}

export function reorderPinnedServers(serverIds: string[]) {
  return apiFetch<PinnedServersListResponse>("/pinned-servers/order", {
    method: "PUT",
    body: JSON.stringify({ serverIds }),
  });
}
