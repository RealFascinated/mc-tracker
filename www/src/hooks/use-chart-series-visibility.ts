import { useCallback, useMemo, useState } from "react";

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
  const derivedKey = `${chartId}\0${seriesLabelsKey}`;

  const storageHidden = useMemo(
    () =>
      resolveHiddenSeriesIndices(seriesLabels, readHiddenSeriesLabels(chartId)),
    [chartId, seriesLabels],
  );

  const [override, setOverride] = useState<{
    key: string;
    hidden: Set<number>;
  } | null>(null);

  const hiddenSeries =
    override?.key === derivedKey ? override.hidden : storageHidden;

  const toggleSeries = useCallback(
    (index: number) => {
      setOverride((previousOverride) => {
        const previous =
          previousOverride?.key === derivedKey
            ? previousOverride.hidden
            : storageHidden;
        const next = new Set(previous);
        if (next.has(index)) {
          next.delete(index);
        } else if (seriesLabels.length - next.size <= 1) {
          return previousOverride;
        } else {
          next.add(index);
        }

        writeHiddenSeriesLabels(
          chartId,
          hiddenIndicesToLabels(seriesLabels, next),
        );
        return { key: derivedKey, hidden: next };
      });
    },
    [chartId, derivedKey, seriesLabels, storageHidden],
  );

  return { hiddenSeries, toggleSeries };
}
