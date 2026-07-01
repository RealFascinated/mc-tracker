import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type uPlot from "uplot";
import type { RefObject } from "react";
import "uplot/dist/uPlot.min.css";

import type {
  AxisRenderConfig,
  TooltipSortEntry,
} from "@/lib/metrics/charts/types";
import type { ChartSeriesRender } from "@/lib/metrics/series";
import type { ChartXRange } from "@/lib/metrics/uplot-theme";
import { stackAlignedData } from "@/lib/metrics/series";
import {
  chartLayoutForDensity,
  readAxisUnitInsets,
} from "@/lib/metrics/uplot-theme";
import { cn } from "cnfast";
import { useTheme } from "@/hooks/use-theme";
import { useMetricChartInstance } from "@/hooks/use-metric-chart-instance";

export type MetricChartMode = "line" | "stack";

const EMPTY_NEGATED: Array<boolean> = [];
const EMPTY_SERIES_RENDERS: Array<ChartSeriesRender> = [];

type MetricChartProps = {
  data: uPlot.AlignedData;
  labels: Array<string>;
  chartAxes: Array<AxisRenderConfig>;
  seriesAxisIds: Array<string>;
  negated?: Array<boolean>;
  seriesRenders?: Array<ChartSeriesRender>;
  seriesFormatters?: Array<(value: number) => string>;
  height?: number;
  sizeRef?: RefObject<HTMLElement | null>;
  xRange?: ChartXRange;
  mode?: MetricChartMode;
  tooltipColumnSize?: number;
  tooltipSort?: (a: TooltipSortEntry, b: TooltipSortEntry) => number;
  showTooltip?: boolean;
  compact?: boolean;
  hiddenSeries?: ReadonlySet<number>;
  sourceIndices?: Array<number>;
  hideYAxis?: boolean;
  xTime?: boolean;
  seriesColors?: Array<string>;
  seriesFills?: Array<boolean | undefined>;
};

const axisUnitClassName =
  "pointer-events-none absolute top-0.5 z-10 text-[10px] font-medium leading-none text-muted-foreground";

function MetricChart({
  data,
  labels,
  chartAxes,
  seriesAxisIds,
  negated = EMPTY_NEGATED,
  seriesRenders = EMPTY_SERIES_RENDERS,
  seriesFormatters,
  height = 260,
  sizeRef,
  xRange,
  mode = "line",
  tooltipColumnSize,
  tooltipSort,
  showTooltip = true,
  compact = false,
  hiddenSeries,
  sourceIndices,
  hideYAxis = false,
  xTime = true,
  seriesColors,
  seriesFills,
}: MetricChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const seriesFormattersRef = useRef(seriesFormatters);
  const dataRef = useRef(data);
  const hiddenSeriesRef = useRef(hiddenSeries);
  const sourceIndicesRef = useRef(sourceIndices);
  const { resolvedTheme } = useTheme();
  const [unitInsets, setUnitInsets] = useState({ left: 10, right: 14 });
  const [layoutDensity, setLayoutDensity] = useState<"normal" | "compact">(
    "normal",
  );
  const layoutDensityRef = useRef(layoutDensity);
  const activeLayout = chartLayoutForDensity(layoutDensity);
  const labelsKey = labels.join("\0");
  const negatedKey = negated.map(String).join("\0");
  const seriesAxisIdsKey = seriesAxisIds.join("\0");
  const seriesRendersKey = seriesRenders.join("\0");
  const seriesColorsKey = seriesColors?.join("\0") ?? "";
  const seriesFillsKey =
    seriesFills?.map((fill) => String(fill)).join("\0") ?? "";
  const chartAxesKey = chartAxes
    .map((axis) => `${axis.id}:${axis.visible}:${axis.yRange.max}:${axis.side}`)
    .join("|");
  const stacked = mode === "stack";
  const bidirectional = negated.some(Boolean);
  const reserveUnitLabels = !compact && chartAxes.some((axis) => axis.visible);

  const unitLabels = useMemo(() => {
    const axisLabels: Array<{ id: string; side: string; label: string }> = [];
    for (const axis of chartAxes) {
      if (!axis.visible) {
        continue;
      }
      const label = axis.format.axisUnitLabel(Math.abs(axis.yRange.max ?? 1));
      if (label) {
        axisLabels.push({ id: axis.id, side: axis.side, label });
      }
    }
    return axisLabels;
  }, [chartAxes]);

  const prepared = useMemo(() => {
    if (!stacked) return { data, bands: undefined };
    const result = stackAlignedData(data);
    return { data: result.data, bands: result.bands };
  }, [data, stacked]);
  const preparedDataRef = useRef(prepared.data);
  const preparedBandsRef = useRef(prepared.bands);
  preparedDataRef.current = prepared.data;
  preparedBandsRef.current = prepared.bands;
  const bandsKey =
    prepared.bands?.map((band) => band.series.join(":")).join("|") ?? "";

  seriesFormattersRef.current = seriesFormatters;
  dataRef.current = prepared.data;
  hiddenSeriesRef.current = hiddenSeries;
  sourceIndicesRef.current = sourceIndices;

  const applySeriesVisibility = useCallback(
    (chart: uPlot) => {
      const indices =
        sourceIndicesRef.current ?? labels.map((_, index) => index);
      for (let j = 0; j < labels.length; j++) {
        chart.setSeries(j + 1, {
          show: !hiddenSeriesRef.current?.has(indices[j]),
        });
      }
    },
    [labels],
  );

  const syncUnitInsets = useCallback(
    (chart: uPlot) => {
      const next = readAxisUnitInsets(chart, chartAxes);
      setUnitInsets((current) =>
        current.left === next.left && current.right === next.right
          ? current
          : next,
      );
    },
    [chartAxes],
  );

  useMetricChartInstance({
    containerRef,
    chartRef,
    seriesFormattersRef,
    dataRef,
    hiddenSeriesRef,
    sourceIndicesRef,
    layoutDensityRef,
    applySeriesVisibility,
    syncUnitInsets,
    resolvedTheme,
    labels,
    labelsKey,
    chartAxes,
    chartAxesKey,
    seriesAxisIds,
    seriesAxisIdsKey,
    negated,
    negatedKey,
    seriesRenders,
    seriesRendersKey,
    seriesColors,
    seriesColorsKey,
    seriesFills,
    seriesFillsKey,
    seriesFormatters,
    height,
    sizeRef,
    xRange,
    stacked,
    preparedDataRef,
    preparedBandsRef,
    bandsKey,
    bidirectional,
    compact,
    hideYAxis,
    xTime,
    reserveUnitLabels,
    showTooltip,
    tooltipColumnSize,
    tooltipSort,
    setLayoutDensity,
  });

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setData(prepared.data);
    if (xRange) {
      chart.setScale("x", { min: xRange.min, max: xRange.max });
    }
    syncUnitInsets(chart);
  }, [chartAxes, prepared.data, syncUnitInsets, xRange]);

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    applySeriesVisibility(chart);
  }, [applySeriesVisibility, hiddenSeries, labelsKey, sourceIndices]);

  const leftUnit = unitLabels.find((entry) => entry.side === "left");
  const rightUnits = unitLabels.filter((entry) => entry.side === "right");

  return (
    <div className="relative h-full w-full">
      {reserveUnitLabels && leftUnit ? (
        <span className={axisUnitClassName} style={{ left: unitInsets.left }}>
          {leftUnit.label}
        </span>
      ) : null}
      {reserveUnitLabels
        ? rightUnits.map((entry, index) => (
            <span
              key={entry.id}
              className={cn(axisUnitClassName, "text-right")}
              style={{
                right:
                  unitInsets.right +
                  index * (activeLayout.density === "compact" ? 20 : 28),
              }}
            >
              {entry.label}
            </span>
          ))
        : null}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

export { MetricChart };
