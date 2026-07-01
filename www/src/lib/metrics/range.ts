import { METRIC_WINDOW_MAX_SPAN_SECONDS } from "@/lib/metrics/window-policy";

const DAY_SECONDS = 86_400;

const METRIC_RANGE_OPTION_DEFS = [
  {
    value: "1h",
    label: "Last hour",
    shortLabel: "1h",
    group: "hours",
    lookbackSeconds: 3_600,
  },
  {
    value: "3h",
    label: "Last 3 hours",
    shortLabel: "3h",
    group: "hours",
    lookbackSeconds: 10_800,
  },
  {
    value: "6h",
    label: "Last 6 hours",
    shortLabel: "6h",
    group: "hours",
    lookbackSeconds: 21_600,
  },
  {
    value: "12h",
    label: "Last 12 hours",
    shortLabel: "12h",
    group: "hours",
    lookbackSeconds: 43_200,
  },
  {
    value: "24h",
    label: "Last 24 hours",
    shortLabel: "24h",
    group: "hours",
    lookbackSeconds: DAY_SECONDS,
  },
  {
    value: "3d",
    label: "Last 3 days",
    shortLabel: "3d",
    group: "days",
    lookbackSeconds: 3 * DAY_SECONDS,
  },
  {
    value: "7d",
    label: "Last 7 days",
    shortLabel: "7d",
    group: "days",
    lookbackSeconds: 7 * DAY_SECONDS,
  },
  {
    value: "2w",
    label: "Last 2 weeks",
    shortLabel: "2w",
    group: "weeks",
    lookbackSeconds: 14 * DAY_SECONDS,
  },
  {
    value: "1mo",
    label: "Last 30 days",
    shortLabel: "30d",
    group: "months",
    lookbackSeconds: 30 * DAY_SECONDS,
  },
  {
    value: "3mo",
    label: "Last 3 months",
    shortLabel: "3mo",
    group: "months",
    lookbackSeconds: 90 * DAY_SECONDS,
  },
  {
    value: "6mo",
    label: "Last 180 days",
    shortLabel: "6mo",
    group: "months",
    lookbackSeconds: 180 * DAY_SECONDS,
  },
  {
    value: "1y",
    label: "Last year",
    shortLabel: "1y",
    group: "years",
    lookbackSeconds: 365 * DAY_SECONDS,
  },
  {
    value: "2y",
    label: "Last 2 years",
    shortLabel: "2y",
    group: "years",
    lookbackSeconds: METRIC_WINDOW_MAX_SPAN_SECONDS,
  },
] as const;

export type MetricTimeRange = (typeof METRIC_RANGE_OPTION_DEFS)[number]["value"];

export type MetricRangeGroupId =
  (typeof METRIC_RANGE_OPTION_DEFS)[number]["group"];

export const METRIC_RANGE_LOOKBACK_SECONDS = Object.fromEntries(
  METRIC_RANGE_OPTION_DEFS.map((option) => [
    option.value,
    option.lookbackSeconds,
  ]),
) as Record<MetricTimeRange, number>;

export const DEFAULT_METRIC_TIME_RANGE = "24h" satisfies MetricTimeRange;

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

export const METRIC_RANGE_OPTIONS: Array<MetricRangeOption> =
  METRIC_RANGE_OPTION_DEFS.map(({ value, label, shortLabel }) => ({
    value,
    label,
    shortLabel,
  }));

const METRIC_RANGE_GROUP_LABELS: Record<MetricRangeGroupId, string> = {
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
  months: "Months",
  years: "Years",
};

const METRIC_RANGE_GROUP_ORDER: Array<MetricRangeGroupId> = [
  "hours",
  "days",
  "weeks",
  "months",
  "years",
];

export const METRIC_RANGE_GROUPS: Array<MetricRangeGroup> =
  METRIC_RANGE_GROUP_ORDER.map((id) => ({
    id,
    label: METRIC_RANGE_GROUP_LABELS[id],
    options: METRIC_RANGE_OPTION_DEFS.filter((option) => option.group === id).map(
      ({ value, label, shortLabel }) => ({ value, label, shortLabel }),
    ),
  }));

const METRIC_RANGE_BY_VALUE = Object.fromEntries(
  METRIC_RANGE_OPTIONS.map((option) => [option.value, option]),
) as Record<MetricTimeRange, MetricRangeOption>;

const METRIC_RANGE_VALUES = new Set<string>(
  METRIC_RANGE_OPTIONS.map((option) => option.value),
);

export function getMetricRangeOption(
  value: MetricTimeRange,
): MetricRangeOption {
  return METRIC_RANGE_BY_VALUE[value];
}

export function parseMetricRangeSearchParam(
  value: unknown,
): MetricTimeRange | undefined {
  if (typeof value !== "string" || !METRIC_RANGE_VALUES.has(value)) {
    return undefined;
  }

  return value as MetricTimeRange;
}
