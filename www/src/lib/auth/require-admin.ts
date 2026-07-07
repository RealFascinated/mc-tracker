import { redirect } from "@tanstack/react-router";

import { fetchCurrentUser } from "@/lib/auth/session";
import type { User } from "@/lib/auth/types";
import { canManageServers } from "@/lib/user-flags";

export async function requireAdmin(): Promise<User> {
  const user = await fetchCurrentUser();

  if (!user) {
    throw redirect({ to: "/login" });
  }

  if (user.role !== "admin") {
    throw redirect({ to: "/account" });
  }

  return user;
}

export async function requireAdminAccess(): Promise<User> {
  const user = await fetchCurrentUser();

  if (!user) {
    throw redirect({ to: "/login" });
  }

  if (!canManageServers(user.flags)) {
    throw redirect({ to: "/account" });
  }

  return user;
}

export function adminLandingPath(user: User): "/admin/settings" | "/admin/servers" {
  return user.role === "admin" ? "/admin/settings" : "/admin/servers";
}
