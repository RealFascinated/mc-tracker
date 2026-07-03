import type { UserRole } from "@/lib/auth/types";

// Bit positions must stay in sync with mc-db/src/model/user_flags.rs
export const UserFlag = {
  UNLIMITED_CHAT: 1 << 0,
} as const;

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
];

export function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) !== 0;
}

export function setFlag(flags: number, flag: number, enabled: boolean): number {
  return enabled ? flags | flag : flags & ~flag;
}

export function chatQuotaExempt(role: UserRole, flags: number): boolean {
  return role === "admin" || hasFlag(flags, UserFlag.UNLIMITED_CHAT);
}
