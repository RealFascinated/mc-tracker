import type { MetricTimeRange } from "@/lib/metrics/range";
import { METRIC_RANGE_LOOKBACK_SECONDS } from "@/lib/metrics/range";

export type MetricTimeWindow =
  | { kind: "preset"; range: MetricTimeRange }
  | { kind: "custom"; from: number; to: number };

export function metricTimeWindowToEpochWindow(window: MetricTimeWindow): {
  from: number;
  to: number;
} {
  if (window.kind === "custom") {
    return { from: window.from, to: window.to };
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
