import { notFound } from "@tanstack/react-router";

import { ApiClientError } from "@/lib/api/client";

export async function ensureQueryOrNotFound<T>(
  fetch: () => Promise<T>,
): Promise<T> {
  try {
    return await fetch();
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw notFound();
    }
    throw error;
  }
}
