import { apiFetch } from "@/lib/api/client";

export type AdminServer = {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminServersListResponse = {
  servers: AdminServer[];
};

export type CreateServerRequest = {
  name: string;
  host: string;
  port?: number | null;
  type: string;
};

export type UpdateServerRequest = Partial<CreateServerRequest>;

export function getAdminServers() {
  return apiFetch<AdminServersListResponse>("/admin/servers");
}

export function createAdminServer(body: CreateServerRequest) {
  return apiFetch<AdminServer>("/admin/servers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAdminServer(id: string, body: UpdateServerRequest) {
  return apiFetch<AdminServer>(`/admin/servers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteAdminServer(id: string) {
  return apiFetch<void>(`/admin/servers/${id}`, {
    method: "DELETE",
  });
}
