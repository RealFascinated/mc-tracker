import type { MetricTimeRange } from "@/lib/metrics/range";
import {
  DEFAULT_METRIC_TIME_RANGE,
  getMetricRangeOption,
  METRIC_RANGE_LOOKBACK_SECONDS,
  parseMetricRangeSearchParam,
} from "@/lib/metrics/range";
import { formatEpochRangeParts } from "@/lib/formatter";

export const METRIC_WINDOW_MIN_SPAN_SECONDS = 5 * 60;
export const METRIC_WINDOW_MAX_SPAN_SECONDS = 730 * 24 * 60 * 60;

export type MetricTimeWindow =
  | { kind: "preset"; range: MetricTimeRange }
  | { kind: "custom"; from: number; to: number };

export type MetricTimeWindowSearch = {
  range?: MetricTimeRange;
  from?: number;
  to?: number;
};

function parseEpochSearchParam(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return undefined;
}

export function parseMetricTimeWindowSearch(
  search: Record<string, unknown>,
): MetricTimeWindowSearch {
  return {
    range: parseMetricRangeSearchParam(search.range),
    from: parseEpochSearchParam(search.from),
    to: parseEpochSearchParam(search.to),
  };
}

export function validateMetricEpochWindow(
  from: number,
  to: number,
  now = Math.floor(Date.now() / 1000),
): string | undefined {
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return "Enter valid start and end times.";
  }

  const clampedTo = Math.min(to, now);
  if (from >= clampedTo) {
    return "Start time must be before end time.";
  }

  const span = clampedTo - from;
  if (span < METRIC_WINDOW_MIN_SPAN_SECONDS) {
    return "Range must be at least 5 minutes.";
  }

  if (span > METRIC_WINDOW_MAX_SPAN_SECONDS) {
    return "Range must be at most 2 years.";
  }

  return undefined;
}

export function metricTimeWindowSearchParams(
  search: MetricTimeWindowSearch,
): MetricTimeWindowSearch {
  const window = metricTimeWindowFromSearch(search);
  if (window.kind === "custom") {
    return { from: window.from, to: window.to };
  }

  if (window.range === DEFAULT_METRIC_TIME_RANGE) {
    return {};
  }

  return { range: window.range };
}

export function metricTimeWindowFromSearch(
  search: MetricTimeWindowSearch,
): MetricTimeWindow {
  const { range, from, to } = search;
  if (from != null && to != null) {
    const error = validateMetricEpochWindow(from, to);
    if (!error) {
      return {
        kind: "custom",
        from,
        to: Math.min(to, Math.floor(Date.now() / 1000)),
      };
    }
  }

  return {
    kind: "preset",
    range: range ?? DEFAULT_METRIC_TIME_RANGE,
  };
}

export function metricTimeWindowToEpochWindow(window: MetricTimeWindow): {
  from: number;
  to: number;
} {
  if (window.kind === "custom") {
    const to = Math.min(window.to, Math.floor(Date.now() / 1000));
    return { from: window.from, to };
  }

  const to = Math.floor(Date.now() / 1000);
  const from = to - METRIC_RANGE_LOOKBACK_SECONDS[window.range];
  return { from, to };
}

export function metricTimeWindowQueryKey(
  window: MetricTimeWindow,
): string | number[] {
  if (window.kind === "preset") {
    return window.range;
  }

  return [window.from, window.to];
}

export function formatMetricTimeWindowLabel(window: MetricTimeWindow): string {
  if (window.kind === "preset") {
    return getMetricRangeOption(window.range).label;
  }

  const { headline } = formatEpochRangeParts(window.from, window.to);
  return headline;
}

export function formatMetricTimeWindowShortLabel(
  window: MetricTimeWindow,
): string {
  if (window.kind === "preset") {
    return getMetricRangeOption(window.range).shortLabel;
  }

  const { from, to } = metricTimeWindowToEpochWindow(window);
  const start = new Date(from * 1000);
  const end = new Date(to * 1000);
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function isPresetMetricTimeWindow(
  window: MetricTimeWindow,
  range: MetricTimeRange,
): boolean {
  return window.kind === "preset" && window.range === range;
}
