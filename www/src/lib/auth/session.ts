import { apiFetch } from "@/lib/api/client";
import type { MeResponse } from "@/lib/auth/types";

export async function fetchCurrentUser() {
  try {
    return await apiFetch<MeResponse>("/auth/me");
  } catch {
    return null;
  }
}

export function getMe() {
  return apiFetch<MeResponse>("/auth/me");
}
