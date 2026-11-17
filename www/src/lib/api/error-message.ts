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

// Raw API messages are aimed at whoever wired the backend up ("Failed to
// deserialize query string: missing field `sort`"), so dashboard readers get
// status copy instead and the raw text is left to the console.
const STATUS_COPY: Record<number, string> = {
  0: "Could not reach the tracker.",
  408: "The tracker took too long to respond.",
  429: "Too many requests. Try again shortly.",
  500: "The tracker hit an internal error.",
  502: "The tracker is unreachable right now.",
  503: "The tracker is not ready yet.",
  504: "The tracker took too long to respond.",
};

export function statusErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiClientError)) {
    return undefined;
  }

  return STATUS_COPY[error.status];
}

export function apiErrorDetail(error: unknown): string | undefined {
  if (!(error instanceof ApiClientError) || error.status <= 0) {
    return undefined;
  }

  return `HTTP ${error.status}`;
}
