import { ApiClientError, apiFetch } from "@/lib/api/client";
import { getMe } from "@/lib/auth/session";
import type { Credentials, LoginResponse, User } from "@/lib/auth/types";

export type {
  Credentials,
  LoginResponse,
  MeResponse,
  User,
  UserRole,
} from "@/lib/auth/types";
export { ApiClientError, apiFetch } from "@/lib/api/client";
export { AuthProvider, useAuth } from "@/lib/auth/context";
export { fetchCurrentUser, getMe } from "@/lib/auth/session";
export { requireAdmin } from "@/lib/auth/require-admin";
export { validateCredentials } from "@/lib/auth/validation";

export type AuthResult = { error: string } | { user: User };

export async function login(credentials: Credentials): Promise<AuthResult> {
  try {
    const result = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
      credentials: "include",
    });
    const user = await getMe();
    return { user: user ?? result };
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<void>("/auth/logout", { method: "POST" });
  } catch {
    // Best-effort server revocation.
  }
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiFetch<void>("/auth/password", {
    method: "PATCH",
    body: JSON.stringify({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    }),
  });
}

export async function signup(credentials: Credentials): Promise<AuthResult> {
  try {
    const result = await apiFetch<LoginResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(credentials),
      credentials: "include",
    });
    const user = await getMe();
    return { user: user ?? result };
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 401 || error.status === 409) {
        return { error: error.message };
      }
      if (error.status === 403) {
        return { error: "Sign up is disabled" };
      }
    }
    throw error;
  }
}
