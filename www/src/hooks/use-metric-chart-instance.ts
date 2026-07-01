import { useLayoutEffect, useRef } from "react";
import uPlot from "uplot";
import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";

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
  getChartColors,
} from "@/lib/metrics/chart-colors";
import {
  createChartZoomSyncHook,
  registerMetricsChartSync,
  unregisterMetricsChartSync,
  useMetricsChartSyncKey,
} from "@/lib/metrics/chart-sync";
import {
  bindChartZoomNavigate,
  useMetricsChartZoom,
} from "@/lib/metrics/chart-zoom";
import {
  buildUPlotOptions,
  chartLayoutForWidth,
  chartPxRatio,
} from "@/lib/metrics/uplot-theme";

type UseMetricChartInstanceParams = {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<uPlot | null>;
  seriesFormattersRef: RefObject<
    Array<(value: number) => string> | undefined
  >;
  dataRef: RefObject<uPlot.AlignedData>;
  hiddenSeriesRef: RefObject<ReadonlySet<number> | undefined>;
  sourceIndicesRef: RefObject<Array<number> | undefined>;
  layoutDensityRef: RefObject<"normal" | "compact">;
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
  preparedDataRef: RefObject<uPlot.AlignedData>;
  preparedBandsRef: RefObject<Array<uPlot.Band> | undefined>;
  bandsKey: string;
  bidirectional: boolean;
  compact: boolean;
  hideYAxis: boolean;
  xTime: boolean;
  reserveUnitLabels: boolean;
  showTooltip: boolean;
  tooltipColumnSize: number | undefined;
  tooltipSort:
    | ((a: TooltipSortEntry, b: TooltipSortEntry) => number)
    | undefined;
  setLayoutDensity: Dispatch<SetStateAction<"normal" | "compact">>;
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
}: UseMetricChartInstanceParams) {
  const chartZoom = useMetricsChartZoom();
  const syncKey = useMetricsChartSyncKey() ?? undefined;
  const chartZoomRef = useRef(chartZoom);
  chartZoomRef.current = chartZoom;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let chart: uPlot | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let unbindInteractionDismiss: (() => void) | null = null;
    let unbindZoomNavigate: (() => void) | null = null;
    let tooltip: HTMLDivElement | null = null;
    const xDrag = Boolean(chartZoomRef.current) && !compact;

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
    if (layout.density !== layoutDensityRef.current) {
      layoutDensityRef.current = layout.density;
      setLayoutDensity(layout.density);
    }

    const mountData = preparedDataRef.current;
    const mountBands = preparedBandsRef.current;

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
      bands: mountBands,
      bidirectional,
      negated,
      compact,
      hideYAxis,
      xTime,
      reserveUnitLabels,
      layout,
      seriesColors,
      seriesFills,
      xDrag,
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
    if (syncKey) {
      hooks.setScale = [createChartZoomSyncHook(syncKey)];
    }
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
      {
        ...options,
        width: initialWidth,
        pxRatio: chartPxRatio(),
      } as uPlot.Options,
      mountData,
      container,
    );
    chartRef.current = chart;
    if (syncKey) {
      registerMetricsChartSync(syncKey, chart);
    }
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
          chart.setSize({ width, height: chartHeight });
        }
        syncUnitInsets(chart);
      }
    });
    const sizeElement = getSizeElement();
    if (sizeElement) resizeObserver.observe(sizeElement);

    unbindInteractionDismiss =
      showTooltip && tooltip
        ? bindChartInteractionDismiss(chart, tooltip)
        : null;

    const zoom = chartZoomRef.current;
    if (zoom) {
      unbindZoomNavigate = bindChartZoomNavigate(chart, zoom.getZoomContext);
    }

    return () => {
      unbindInteractionDismiss?.();
      unbindZoomNavigate?.();
      resizeObserver.disconnect();
      if (tooltip) destroyChartTooltipElement(tooltip);
      if (syncKey) {
        unregisterMetricsChartSync(syncKey, chart);
      }
      chart.destroy();
      chartRef.current = null;
    };
  }, [
    applySeriesVisibility,
    bidirectional,
    bandsKey,
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
    layoutDensityRef,
    negated,
    negatedKey,
    preparedBandsRef,
    preparedDataRef,
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
    syncKey,
    syncUnitInsets,
    tooltipColumnSize,
    tooltipSort,
    xRange,
    xTime,
  ]);
}

export { useMetricChartInstance };
