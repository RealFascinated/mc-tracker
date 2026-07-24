import type { User } from "@/lib/auth/types";

export function userDisplayName(user: Pick<User, "displayName" | "email">) {
  const displayName = user.displayName?.trim();
  return displayName && displayName.length > 0 ? displayName : user.email;
}
