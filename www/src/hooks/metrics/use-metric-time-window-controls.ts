import { useCallback, useMemo } from "react";

import { DEFAULT_METRIC_TIME_RANGE } from "@/lib/metrics/range";
import type { MetricTimeRange } from "@/lib/metrics/range";
import { metricTimeWindowFromSearch } from "@/lib/metrics/time-window";
import type {
  MetricTimeWindow,
  MetricTimeWindowSearch,
} from "@/lib/metrics/time-window";

export type SearchNavigate = (options: {
  search: (prev: Record<string, unknown>) => Record<string, unknown>;
  replace?: boolean;
  resetScroll?: boolean;
}) => void | Promise<void>;

export function useMetricTimeWindowControls(
  search: MetricTimeWindowSearch,
  navigate: SearchNavigate,
): {
  timeWindow: MetricTimeWindow;
  setPresetTimeRange: (range: MetricTimeRange) => void;
  setCustomTimeRange: (from: number, to: number) => void;
  handleZoomToRange: (from: number, to: number) => void;
} {
  const { range: searchRange, from: searchFrom, to: searchTo } = search;

  const timeWindow = useMemo(
    () =>
      metricTimeWindowFromSearch({
        range: searchRange,
        from: searchFrom,
        to: searchTo,
      }),
    [searchFrom, searchRange, searchTo],
  );

  const setPresetTimeRange = useCallback(
    (range: MetricTimeRange) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          range: range === DEFAULT_METRIC_TIME_RANGE ? undefined : range,
          from: undefined,
          to: undefined,
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

  const navigateCustomTimeRange = useCallback(
    (from: number, to: number, options?: { replace?: boolean }) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          range: undefined,
          from,
          to,
        }),
        replace: options?.replace ?? false,
        resetScroll: false,
      });
    },
    [navigate],
  );

  const setCustomTimeRange = useCallback(
    (from: number, to: number) => {
      navigateCustomTimeRange(from, to, { replace: true });
    },
    [navigateCustomTimeRange],
  );

  const handleZoomToRange = useCallback(
    (from: number, to: number) => {
      navigateCustomTimeRange(
        from,
        Math.min(to, Math.floor(Date.now() / 1000)),
      );
    },
    [navigateCustomTimeRange],
  );

  return {
    timeWindow,
    setPresetTimeRange,
    setCustomTimeRange,
    handleZoomToRange,
  };
}
