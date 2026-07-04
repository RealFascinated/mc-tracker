import { apiUrl } from "@/lib/api/url";
import type { ApiError } from "@/lib/api/types";

export type ApiErrorBody = ApiError;

export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export type ApiFetchOptions = RequestInit & {
  /** When false, do not send cookies (public endpoints). Default true. */
  credentials?: RequestCredentials;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { credentials = "include", ...init } = options;
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers,
      credentials,
    });
  } catch {
    throw new ApiClientError("Network error", 0);
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const error = (await response.json()) as ApiErrorBody;
      if (error.message) {
        message = error.message;
      }
    } catch {
      // Response may have no JSON body.
    }
    throw new ApiClientError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
