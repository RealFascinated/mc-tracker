import { ApiClientError } from "@/lib/api/client";

export function errorMessage(
  error: unknown,
  fallback = "Something went wrong",
) {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
