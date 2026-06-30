const STORAGE_KEY_PREFIX = "mc-tracker:chart-hidden-series:";

function storageKey(chartId: string) {
  return `${STORAGE_KEY_PREFIX}${chartId}`;
}

export function readHiddenSeriesLabels(chartId: string): Array<string> {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(storageKey(chartId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

export function writeHiddenSeriesLabels(
  chartId: string,
  labels: Array<string>,
) {
  if (typeof window === "undefined") return;

  try {
    if (labels.length === 0) {
      localStorage.removeItem(storageKey(chartId));
      return;
    }
    localStorage.setItem(storageKey(chartId), JSON.stringify(labels));
  } catch {
    // ignore quota / privacy mode errors
  }
}

export function hiddenIndicesToLabels(
  seriesLabels: Array<string>,
  hiddenIndices: ReadonlySet<number>,
): Array<string> {
  return seriesLabels.filter((_, index) => hiddenIndices.has(index));
}

export function resolveHiddenSeriesIndices(
  seriesLabels: Array<string>,
  hiddenLabels: Array<string>,
): Set<number> {
  const hidden = new Set<number>();
  const labelIndex = new Map(
    seriesLabels.map((label, index) => [label, index] as const),
  );
  for (const label of hiddenLabels) {
    const index = labelIndex.get(label);
    if (index !== undefined) {
      hidden.add(index);
    }
  }

  if (seriesLabels.length > 0 && hidden.size >= seriesLabels.length) {
    hidden.delete(0);
  }

  return hidden;
}
