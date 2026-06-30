import { redirect } from "@tanstack/react-router";

import { fetchCurrentUser } from "@/lib/auth/session";
import type { User } from "@/lib/auth/types";

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
