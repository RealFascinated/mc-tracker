import { ApiClientError } from "@/lib/api/client";
import { ChatStreamError } from "@/lib/api/chat";

export function errorMessage(
  error: unknown,
  fallback = "Something went wrong",
) {
  if (error instanceof ChatStreamError) {
    return error.message;
  }
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
