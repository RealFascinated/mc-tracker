import { apiFetch } from "@/lib/api/client";

export type AdminUser = {
  id: string;
  username: string;
  role: string;
  flags: number;
  createdAt: string;
};

export type AdminUsersListResponse = {
  users: AdminUser[];
};

export type PatchUserFlagsResponse = {
  id: string;
  flags: number;
};

export function getAdminUsers() {
  return apiFetch<AdminUsersListResponse>("/admin/users");
}

export function updateUserFlags(id: string, flags: number) {
  return apiFetch<PatchUserFlagsResponse>(`/admin/users/${id}/flags`, {
    method: "PATCH",
    body: JSON.stringify({ flags }),
  });
}
