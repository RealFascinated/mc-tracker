import { useCallback, useEffect, useState } from "react";

import {
  hiddenIndicesToLabels,
  readHiddenSeriesLabels,
  resolveHiddenSeriesIndices,
  writeHiddenSeriesLabels,
} from "@/lib/metrics/chart-series-visibility";

export function useChartSeriesVisibility(
  chartId: string,
  seriesLabels: Array<string>,
) {
  const seriesLabelsKey = seriesLabels.join("\0");

  const [hiddenSeries, setHiddenSeries] = useState<Set<number>>(() =>
    resolveHiddenSeriesIndices(seriesLabels, readHiddenSeriesLabels(chartId)),
  );

  useEffect(() => {
    setHiddenSeries(
      resolveHiddenSeriesIndices(seriesLabels, readHiddenSeriesLabels(chartId)),
    );
  }, [chartId, seriesLabelsKey, seriesLabels]);

  const toggleSeries = useCallback(
    (index: number) => {
      setHiddenSeries((previous) => {
        const next = new Set(previous);
        if (next.has(index)) {
          next.delete(index);
        } else if (seriesLabels.length - next.size <= 1) {
          return previous;
        } else {
          next.add(index);
        }

        writeHiddenSeriesLabels(
          chartId,
          hiddenIndicesToLabels(seriesLabels, next),
        );
        return next;
      });
    },
    [chartId, seriesLabels],
  );

  return { hiddenSeries, toggleSeries };
}
