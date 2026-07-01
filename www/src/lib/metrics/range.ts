import { METRIC_WINDOW_MAX_SPAN_SECONDS } from "@/lib/metrics/window-policy";

const DAY_SECONDS = 86_400;

export type MetricTimeRange =
  | "1h"
  | "3h"
  | "6h"
  | "12h"
  | "24h"
  | "3d"
  | "7d"
  | "2w"
  | "1mo"
  | "3mo"
  | "6mo"
  | "1y"
  | "2y";

export const METRIC_RANGE_LOOKBACK_SECONDS: Record<MetricTimeRange, number> = {
  "1h": 3_600,
  "3h": 10_800,
  "6h": 21_600,
  "12h": 43_200,
  "24h": DAY_SECONDS,
  "3d": 3 * DAY_SECONDS,
  "7d": 7 * DAY_SECONDS,
  "2w": 14 * DAY_SECONDS,
  "1mo": 30 * DAY_SECONDS,
  "3mo": 90 * DAY_SECONDS,
  "6mo": 180 * DAY_SECONDS,
  "1y": 365 * DAY_SECONDS,
  "2y": METRIC_WINDOW_MAX_SPAN_SECONDS,
};

const METRIC_RANGES = [
  "1h",
  "3h",
  "6h",
  "12h",
  "24h",
  "3d",
  "7d",
  "2w",
  "1mo",
  "3mo",
  "6mo",
  "1y",
  "2y",
] as const satisfies ReadonlyArray<MetricTimeRange>;

/** @deprecated URL aliases kept for bookmark compatibility. */
const METRIC_RANGE_ALIASES: Record<string, MetricTimeRange> = {
  "1d": "24h",
  "1w": "7d",
};

export const DEFAULT_METRIC_TIME_RANGE: MetricTimeRange = "1mo";

export type MetricRangeGroupId =
  "hours" | "days" | "weeks" | "months" | "years";

export type MetricRangeOption = {
  value: MetricTimeRange;
  label: string;
  shortLabel: string;
};

export type MetricRangeGroup = {
  id: MetricRangeGroupId;
  label: string;
  options: Array<MetricRangeOption>;
};

export const METRIC_RANGE_OPTIONS: Array<MetricRangeOption> = [
  { value: "1h", label: "Last hour", shortLabel: "1h" },
  { value: "3h", label: "Last 3 hours", shortLabel: "3h" },
  { value: "6h", label: "Last 6 hours", shortLabel: "6h" },
  { value: "12h", label: "Last 12 hours", shortLabel: "12h" },
  { value: "24h", label: "Last 24 hours", shortLabel: "24h" },
  { value: "3d", label: "Last 3 days", shortLabel: "3d" },
  { value: "7d", label: "Last 7 days", shortLabel: "7d" },
  { value: "2w", label: "Last 2 weeks", shortLabel: "2w" },
  { value: "1mo", label: "Last 30 days", shortLabel: "30d" },
  { value: "3mo", label: "Last 3 months", shortLabel: "3mo" },
  { value: "6mo", label: "Last 180 days", shortLabel: "6mo" },
  { value: "1y", label: "Last year", shortLabel: "1y" },
  { value: "2y", label: "Last 2 years", shortLabel: "2y" },
];

export const METRIC_RANGE_GROUPS: Array<MetricRangeGroup> = [
  {
    id: "hours",
    label: "Hours",
    options: METRIC_RANGE_OPTIONS.filter((option) =>
      ["1h", "3h", "6h", "12h", "24h"].includes(option.value),
    ),
  },
  {
    id: "days",
    label: "Days",
    options: METRIC_RANGE_OPTIONS.filter((option) =>
      ["3d", "7d"].includes(option.value),
    ),
  },
  {
    id: "weeks",
    label: "Weeks",
    options: METRIC_RANGE_OPTIONS.filter((option) => option.value === "2w"),
  },
  {
    id: "months",
    label: "Months",
    options: METRIC_RANGE_OPTIONS.filter((option) =>
      ["1mo", "3mo"].includes(option.value),
    ),
  },
  {
    id: "years",
    label: "Years",
    options: METRIC_RANGE_OPTIONS.filter((option) =>
      ["1y", "2y"].includes(option.value),
    ),
  },
];

const METRIC_RANGE_BY_VALUE = Object.fromEntries(
  METRIC_RANGE_OPTIONS.map((option) => [option.value, option]),
) as Record<MetricTimeRange, MetricRangeOption>;

export function getMetricRangeOption(
  value: MetricTimeRange,
): MetricRangeOption {
  return METRIC_RANGE_BY_VALUE[value];
}

function normalizeMetricRange(
  value: string,
): MetricTimeRange | undefined {
  const canonical = METRIC_RANGE_ALIASES[value] ?? value;
  if (METRIC_RANGES.includes(canonical)) {
    return canonical;
  }

  return undefined;
}

export function parseMetricRangeSearchParam(
  value: unknown,
): MetricTimeRange | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return normalizeMetricRange(value);
}
