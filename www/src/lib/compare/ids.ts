const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_COMPARE_SERVERS = 5;
export const MIN_COMPARE_SERVERS = 2;

export function parseCompareIdsParam(value: unknown): string[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  const ids = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((id) => UUID_RE.test(id));

  return [...new Set(ids)].slice(0, MAX_COMPARE_SERVERS);
}

export function serializeCompareIds(ids: string[]): string {
  return ids.slice(0, MAX_COMPARE_SERVERS).join(",");
}
