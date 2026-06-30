import { useEffect } from "react";
import uPlot from "uplot";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";

import type { ResolvedTheme } from "@/lib/theme";
import type {
  AxisRenderConfig,
  TooltipSortEntry,
} from "@/lib/metrics/charts/types";
import type { ChartSeriesRender } from "@/lib/metrics/series";
import type { ChartXRange } from "@/lib/metrics/uplot-theme";
import {
  bindChartInteractionDismiss,
  createChartTooltipElement,
  createCursorTooltipHandler,
  destroyChartTooltipElement,
} from "@/lib/metrics/chart-tooltip";
import {
  buildUPlotOptions,
  chartLayoutForWidth,
  getChartColors,
} from "@/lib/metrics/uplot-theme";
import { enqueueChartDestroy } from "@/lib/metrics/chart-hydration-queue";

type UseMetricChartInstanceParams = {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: MutableRefObject<uPlot | null>;
  seriesFormattersRef: MutableRefObject<
    Array<(value: number) => string> | undefined
  >;
  dataRef: MutableRefObject<uPlot.AlignedData>;
  hiddenSeriesRef: MutableRefObject<ReadonlySet<number> | undefined>;
  sourceIndicesRef: MutableRefObject<Array<number> | undefined>;
  layoutDensityRef: MutableRefObject<"normal" | "compact">;
  applySeriesVisibility: (chart: uPlot) => void;
  syncUnitInsets: (chart: uPlot) => void;
  resolvedTheme: ResolvedTheme;
  labels: Array<string>;
  labelsKey: string;
  chartAxes: Array<AxisRenderConfig>;
  chartAxesKey: string;
  seriesAxisIds: Array<string>;
  seriesAxisIdsKey: string;
  negated: Array<boolean>;
  negatedKey: string;
  seriesRenders: Array<ChartSeriesRender>;
  seriesRendersKey: string;
  seriesColors: Array<string> | undefined;
  seriesColorsKey: string;
  seriesFills: Array<boolean | undefined> | undefined;
  seriesFillsKey: string;
  seriesFormatters: Array<(value: number) => string> | undefined;
  height: number;
  sizeRef: RefObject<HTMLElement | null> | undefined;
  xRange: ChartXRange | undefined;
  stacked: boolean;
  preparedData: uPlot.AlignedData;
  preparedBands: Array<uPlot.Band> | undefined;
  bidirectional: boolean;
  compact: boolean;
  hideYAxis: boolean;
  xTime: boolean;
  reserveUnitLabels: boolean;
  showTooltip: boolean;
  tooltipColumnSize: number | undefined;
  tooltipSort: ((a: TooltipSortEntry, b: TooltipSortEntry) => number) | undefined;
  layoutDensity: "normal" | "compact";
  setLayoutDensity: Dispatch<SetStateAction<"normal" | "compact">>;
  xMin: number | null;
  xMax: number | null;
};

function useMetricChartInstance({
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
  preparedData,
  preparedBands,
  bidirectional,
  compact,
  hideYAxis,
  xTime,
  reserveUnitLabels,
  showTooltip,
  tooltipColumnSize,
  tooltipSort,
  layoutDensity,
  setLayoutDensity,
  xMin,
  xMax,
}: UseMetricChartInstanceParams) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let chart: uPlot | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let unbindInteractionDismiss: (() => void) | null = null;
    let tooltip: HTMLDivElement | null = null;

    const frame = requestAnimationFrame(() => {
      if (disposed) return;

      if (showTooltip) {
        tooltip = createChartTooltipElement(resolvedTheme);
      }

      const getSizeElement = () => sizeRef?.current ?? containerRef.current;
      const getChartSize = () => {
        const element = getSizeElement();
        const width = Math.max(element?.clientWidth ?? 1, 1);
        const chartHeight = Math.max(element?.clientHeight ?? height, height);
        return { width, height: chartHeight };
      };

      const { width: initialWidth, height: initialHeight } = getChartSize();
      const layout = chartLayoutForWidth(initialWidth);
      layoutDensityRef.current = layout.density;
      if (layout.density !== layoutDensity) {
        setLayoutDensity(layout.density);
      }

      const options = buildUPlotOptions({
        theme: resolvedTheme,
        labels,
        height: initialHeight,
        chartAxes,
        seriesAxisIds,
        seriesFormatters,
        xRange,
        seriesRenders,
        stacked,
        bands: preparedBands,
        bidirectional,
        negated,
        compact,
        hideYAxis,
        xTime,
        reserveUnitLabels,
        layout,
        seriesColors,
        seriesFills,
      });

      const colors = seriesColors ?? getChartColors(resolvedTheme);
      const formatSeriesValue = (value: number, seriesIndex: number) => {
        const sourceIndex =
          sourceIndicesRef.current?.[seriesIndex] ?? seriesIndex;
        const display =
          seriesIndex >= 0 && negated[seriesIndex] ? Math.abs(value) : value;
        const formatter = seriesFormattersRef.current?.[sourceIndex];
        return formatter?.(display) ?? String(display);
      };

      const hooks: uPlot.Hooks.Arrays = {};
      if (showTooltip && tooltip) {
        hooks.setCursor = [
          createCursorTooltipHandler({
            tooltip,
            labels,
            colors,
            getData: () => dataRef.current,
            formatValue: formatSeriesValue,
            theme: resolvedTheme,
            stacked,
            tooltipColumnSize,
            tooltipSort,
            isSeriesHidden: (seriesIndex) => {
              const sourceIndex =
                sourceIndicesRef.current?.[seriesIndex] ?? seriesIndex;
              return hiddenSeriesRef.current?.has(sourceIndex) ?? false;
            },
          }),
        ];
      }

      options.hooks = hooks;

      chart = new uPlot(
        { ...options, width: initialWidth },
        preparedData,
        container,
      );
      chartRef.current = chart;
      applySeriesVisibility(chart);
      syncUnitInsets(chart);

      let lastWidth = 0;
      let lastHeight = 0;

      resizeObserver = new ResizeObserver(() => {
        const { width, height: chartHeight } = getChartSize();
        if (width > 0 && chartHeight > 0) {
          const nextDensity = chartLayoutForWidth(width).density;
          if (nextDensity !== layoutDensityRef.current) {
            layoutDensityRef.current = nextDensity;
            setLayoutDensity(nextDensity);
          }
          if (width !== lastWidth || chartHeight !== lastHeight) {
            lastWidth = width;
            lastHeight = chartHeight;
            chart?.setSize({ width, height: chartHeight });
          }
          if (chart) syncUnitInsets(chart);
        }
      });
      const sizeElement = getSizeElement();
      if (sizeElement) resizeObserver.observe(sizeElement);

      unbindInteractionDismiss =
        showTooltip && tooltip
          ? bindChartInteractionDismiss(chart, tooltip)
          : null;
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      unbindInteractionDismiss?.();
      resizeObserver?.disconnect();
      if (tooltip) destroyChartTooltipElement(tooltip);
      if (chart) {
        chartRef.current = null;
        enqueueChartDestroy(chart);
      }
    };
  }, [
    applySeriesVisibility,
    bidirectional,
    chartAxes,
    chartAxesKey,
    chartRef,
    compact,
    containerRef,
    dataRef,
    height,
    hiddenSeriesRef,
    hideYAxis,
    labels,
    labelsKey,
    layoutDensity,
    layoutDensityRef,
    negated,
    negatedKey,
    preparedBands,
    preparedData,
    reserveUnitLabels,
    resolvedTheme,
    seriesAxisIds,
    seriesAxisIdsKey,
    seriesColors,
    seriesColorsKey,
    seriesFills,
    seriesFillsKey,
    seriesFormatters,
    seriesFormattersRef,
    seriesRenders,
    seriesRendersKey,
    setLayoutDensity,
    showTooltip,
    sizeRef,
    sourceIndicesRef,
    stacked,
    syncUnitInsets,
    tooltipColumnSize,
    tooltipSort,
    xMax,
    xMin,
    xRange,
    xTime,
  ]);
}

export { useMetricChartInstance };
