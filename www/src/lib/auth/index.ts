import { ApiClientError, apiFetch } from "@/lib/api/client";
import { getMe } from "@/lib/auth/session";
import type {
  Credentials,
  LoginResponse,
  SignupCredentials,
  User,
} from "@/lib/auth/types";

export type AuthResult = { error: string } | { user: User };

export async function login(credentials: Credentials): Promise<AuthResult> {
  try {
    await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
      credentials: "include",
    });
    const user = await getMe();
    return { user };
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

export async function updateProfile(input: {
  email: string;
  displayName: string;
}): Promise<User> {
  return apiFetch<User>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify({
      email: input.email,
      displayName: input.displayName,
    }),
  });
}

export async function deleteAccount(input: { password: string }): Promise<void> {
  await apiFetch<void>("/auth/account", {
    method: "DELETE",
    body: JSON.stringify({ password: input.password }),
  });
}

export async function signup(credentials: SignupCredentials): Promise<AuthResult> {
  try {
    await apiFetch<LoginResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(credentials),
      credentials: "include",
    });
    const user = await getMe();
    return { user };
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
