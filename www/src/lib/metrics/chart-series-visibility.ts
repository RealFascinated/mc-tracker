import {
  readLocalStorageJson,
  removeLocalStorage,
  writeLocalStorageJson,
} from "@/lib/local-storage";

const STORAGE_KEY_PREFIX = "mc-tracker:chart-hidden-series:";

function storageKey(chartId: string) {
  return `${STORAGE_KEY_PREFIX}${chartId}`;
}

function parseHiddenSeriesLabels(raw: unknown): Array<string> | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  return raw.filter((entry): entry is string => typeof entry === "string");
}

export function readHiddenSeriesLabels(chartId: string): Array<string> {
  return (
    readLocalStorageJson(storageKey(chartId), parseHiddenSeriesLabels) ?? []
  );
}

export function writeHiddenSeriesLabels(
  chartId: string,
  labels: Array<string>,
) {
  const key = storageKey(chartId);
  if (labels.length === 0) {
    removeLocalStorage(key);
    return;
  }

  writeLocalStorageJson(key, labels);
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

export function chartHiddenSeriesStorageKey(chartId: string) {
  return storageKey(chartId);
}

export function parseChartHiddenSeriesLabels(raw: unknown): Array<string> | null {
  return parseHiddenSeriesLabels(raw);
}
