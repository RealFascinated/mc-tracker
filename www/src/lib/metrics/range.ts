export type MetricTimeRange = "1h" | "1d" | "1w" | "1mo";

export const METRIC_RANGE_LOOKBACK_SECONDS: Record<MetricTimeRange, number> = {
  "1h": 3_600,
  "1d": 86_400,
  "1w": 604_800,
  "1mo": 2_592_000,
};

export const METRIC_RANGES = [
  "1h",
  "1d",
  "1w",
  "1mo",
] as const satisfies ReadonlyArray<MetricTimeRange>;

export const DEFAULT_METRIC_TIME_RANGE: MetricTimeRange = "1mo";

export type MetricRangeOption = {
  value: MetricTimeRange;
  label: string;
  shortLabel: string;
};

export const METRIC_RANGE_OPTIONS: Array<MetricRangeOption> = [
  { value: "1h", label: "Last hour", shortLabel: "1h" },
  { value: "1d", label: "Last day", shortLabel: "1d" },
  { value: "1w", label: "Last week", shortLabel: "1w" },
  { value: "1mo", label: "Last 30 days", shortLabel: "1mo" },
];

const METRIC_RANGE_BY_VALUE = Object.fromEntries(
  METRIC_RANGE_OPTIONS.map((option) => [option.value, option]),
) as Record<MetricTimeRange, MetricRangeOption>;

export function getMetricRangeOption(
  value: MetricTimeRange,
): MetricRangeOption {
  return METRIC_RANGE_BY_VALUE[value];
}

export function parseMetricRangeSearchParam(
  value: unknown,
): MetricTimeRange | undefined {
  if (
    typeof value === "string" &&
    METRIC_RANGES.includes(value as MetricTimeRange)
  ) {
    return value as MetricTimeRange;
  }

  return undefined;
}

export function parseMetricRange(value: unknown): MetricTimeRange {
  return parseMetricRangeSearchParam(value) ?? DEFAULT_METRIC_TIME_RANGE;
}
