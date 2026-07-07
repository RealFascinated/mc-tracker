import type { UserRole } from "@/lib/auth/types";

// Bit positions must stay in sync with mc-db/src/model/user_flags.rs
const UserFlag = {
  UNLIMITED_CHAT: 1 << 0,
  MANAGE_SERVERS: 1 << 1,
} as const;

export const ALL_USER_FLAGS =
  UserFlag.UNLIMITED_CHAT | UserFlag.MANAGE_SERVERS;

export type UserFlagDefinition = {
  flag: number;
  id: string;
  label: string;
  description: string;
};

/** Known user flags and their admin UI labels. */
export const USER_FLAGS: readonly UserFlagDefinition[] = [
  {
    flag: UserFlag.UNLIMITED_CHAT,
    id: "unlimited-chat",
    label: "Unlimited chat",
    description: "Bypass the weekly chat message quota.",
  },
  {
    flag: UserFlag.MANAGE_SERVERS,
    id: "manage-servers",
    label: "Manage servers",
    description: "Add, edit, and remove tracked servers.",
  },
];

export function effectiveFlags(role: UserRole, flags: number): number {
  return role === "admin" ? ALL_USER_FLAGS : flags;
}

export function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) !== 0;
}

export function setFlag(flags: number, flag: number, enabled: boolean): number {
  return enabled ? flags | flag : flags & ~flag;
}

export function chatQuotaExempt(flags: number): boolean {
  return hasFlag(flags, UserFlag.UNLIMITED_CHAT);
}

export function canManageServers(flags: number): boolean {
  return hasFlag(flags, UserFlag.MANAGE_SERVERS);
}
