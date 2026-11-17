import { notFound } from "@tanstack/react-router";

import { ApiClientError } from "@/lib/api/client";

// A 400 from these endpoints means the path identifier could not be parsed at
// all (a server id that is not a UUID, an ASN that is not a number), so no
// entity can ever match it and the styled not-found page is the honest answer.
const NOT_FOUND_STATUSES = new Set([400, 404]);

export async function ensureQueryOrNotFound<T>(
  fetch: () => Promise<T>,
): Promise<T> {
  try {
    return await fetch();
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      NOT_FOUND_STATUSES.has(error.status)
    ) {
      throw notFound();
    }
    throw error;
  }
}
