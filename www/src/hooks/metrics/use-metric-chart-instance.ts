import { useLayoutEffect, useRef } from "react";
import uPlot from "uplot";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type { ResolvedTheme } from "@/lib/theme/theme-context";
import type {
  AxisRenderConfig,
  TooltipSortEntry,
} from "@/lib/metrics/charts/types";
import type { ChartSeriesRender } from "@/lib/metrics/series";
import type { MetricsDataWindow } from "@/lib/metrics/chart-zoom";
import {
  applyChartXWindow,
  createChartZoomSelectHook,
} from "@/lib/metrics/chart-zoom";
import {
  bindChartInteractionDismiss,
  createChartTooltipElement,
  createCursorTooltipHandler,
  destroyChartTooltipElement,
} from "@/lib/metrics/chart-tooltip";
import { getChartColors } from "@/lib/metrics/chart-colors";
import { useMetricsChartSyncKey } from "@/hooks/metrics/use-metrics-chart-sync-key";
import {
  registerMetricsChartSync,
  unregisterMetricsChartSync,
} from "@/lib/metrics/chart-sync";
import { useMetricsChartZoom } from "@/hooks/metrics/use-metrics-chart-zoom";
import { createEventAnnotationDrawHook } from "@/lib/metrics/chart-event-annotations";
import type { ChartEventAnnotation } from "@/lib/metrics/chart-event-annotations";
import {
  buildUPlotOptions,
  chartLayoutForWidth,
  chartPxRatio,
} from "@/lib/metrics/uplot-theme";

type UseMetricChartInstanceParams = {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<uPlot | null>;
  seriesFormattersRef: RefObject<Array<(value: number) => string> | undefined>;
  dataRef: RefObject<uPlot.AlignedData>;
  hiddenSeriesRef: RefObject<ReadonlySet<number> | undefined>;
  sourceIndicesRef: RefObject<Array<number> | undefined>;
  layoutDensityRef: RefObject<"normal" | "compact">;
  applySeriesVisibilityRef: RefObject<(chart: uPlot) => void>;
  syncUnitInsetsRef: RefObject<(chart: uPlot) => void>;
  getXWindowRef: RefObject<() => MetricsDataWindow | undefined>;
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
  seriesFills: Array<boolean | undefined> | undefined;
  seriesFillsKey: string;
  height: number;
  sizeRef: RefObject<HTMLElement | null> | undefined;
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
    ((a: TooltipSortEntry, b: TooltipSortEntry) => number) | undefined;
  setLayoutDensity: Dispatch<SetStateAction<"normal" | "compact">>;
  inlineLegend?: boolean;
  eventAnnotationsRef?: RefObject<ChartEventAnnotation[] | undefined>;
  showAnnotationsRef?: RefObject<boolean>;
};

function useMetricChartInstance({
  containerRef,
  chartRef,
  seriesFormattersRef,
  dataRef,
  hiddenSeriesRef,
  sourceIndicesRef,
  layoutDensityRef,
  applySeriesVisibilityRef,
  syncUnitInsetsRef,
  getXWindowRef,
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
  seriesFills,
  seriesFillsKey,
  height,
  sizeRef,
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
  inlineLegend = false,
  eventAnnotationsRef,
  showAnnotationsRef,
}: UseMetricChartInstanceParams) {
  const chartZoom = useMetricsChartZoom();
  const syncKey = useMetricsChartSyncKey() ?? undefined;
  const chartZoomRef = useRef(chartZoom);
  const themeRef = useRef(resolvedTheme);
  const seriesColorsRef = useRef(seriesColors);
  chartZoomRef.current = chartZoom;
  themeRef.current = resolvedTheme;
  seriesColorsRef.current = seriesColors;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let chart: uPlot | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let unbindInteractionDismiss: (() => void) | null = null;
    let tooltip: HTMLDivElement | null = null;
    const xDrag = Boolean(chartZoomRef.current) && !compact;

    if (showTooltip) {
      tooltip = createChartTooltipElement(resolvedTheme);
    }

    const getSizeElement = () => sizeRef?.current ?? containerRef.current;
    const getChartSize = () => {
      const element = getSizeElement();
      const width = Math.max(element?.clientWidth ?? 1, 1);
      const chartHeight =
        element && element.clientHeight > 0 ? element.clientHeight : height;
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

    const mountXWindow = getXWindowRef.current();

    const options = buildUPlotOptions({
      labels,
      height: initialHeight,
      chartAxes,
      seriesAxisIds,
      seriesFormatters: seriesFormattersRef.current,
      xRange: mountXWindow
        ? { min: mountXWindow.from, max: mountXWindow.to }
        : undefined,
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
      seriesColors: seriesColorsRef.current,
      seriesFills,
      xDrag,
      inlineLegend,
    });

    const colors = seriesColorsRef.current ?? getChartColors();
    const formatSeriesValue = (value: number, seriesIndex: number) => {
      const sourceIndex =
        sourceIndicesRef.current?.[seriesIndex] ?? seriesIndex;
      const display =
        seriesIndex >= 0 && negated[seriesIndex] ? Math.abs(value) : value;
      const formatter = seriesFormattersRef.current?.[sourceIndex];
      return formatter?.(display) ?? String(display);
    };

    const hooks: uPlot.Hooks.Arrays = {};
    const zoom = chartZoomRef.current;
    if (xDrag && zoom) {
      hooks.setSelect = [createChartZoomSelectHook(zoom.getZoomContext)];
    }
    if (eventAnnotationsRef) {
      hooks.draw = [
        createEventAnnotationDrawHook(
          () =>
            showAnnotationsRef?.current
              ? (eventAnnotationsRef.current ?? [])
              : [],
        ),
      ];
    }
    if (showTooltip && tooltip) {
      hooks.setCursor = [
        createCursorTooltipHandler({
          tooltip,
          labels,
          colors,
          getData: () => dataRef.current,
          formatValue: formatSeriesValue,
          getTheme: () => themeRef.current,
          stacked,
          tooltipColumnSize,
          tooltipSort,
          isSeriesHidden: (seriesIndex) => {
            const sourceIndex =
              sourceIndicesRef.current?.[seriesIndex] ?? seriesIndex;
            return hiddenSeriesRef.current?.has(sourceIndex) ?? false;
          },
          seriesRenders,
          getEventAnnotations: eventAnnotationsRef
            ? () =>
                showAnnotationsRef?.current
                  ? (eventAnnotationsRef.current ?? [])
                  : []
            : undefined,
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
    applySeriesVisibilityRef.current(chart);
    syncUnitInsetsRef.current(chart);

    if (mountXWindow) {
      applyChartXWindow(chart, mountXWindow);
    }

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
        syncUnitInsetsRef.current(chart);
      }
    });
    const sizeElement = getSizeElement();
    if (sizeElement) resizeObserver.observe(sizeElement);

    const syncSizeAfterLayout = () => {
      const { width, height: chartHeight } = getChartSize();
      if (width > 0 && chartHeight > 0) {
        chart.setSize({ width, height: chartHeight });
        syncUnitInsetsRef.current(chart);
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(syncSizeAfterLayout);
    });

    unbindInteractionDismiss =
      showTooltip && tooltip
        ? bindChartInteractionDismiss(chart, tooltip)
        : null;

    return () => {
      unbindInteractionDismiss?.();
      resizeObserver.disconnect();
      if (tooltip) {
        destroyChartTooltipElement(tooltip);
      }
      if (syncKey) {
        unregisterMetricsChartSync(syncKey, chart);
      }
      chart.destroy();
      chartRef.current = null;
    };
  }, [
    applySeriesVisibilityRef,
    bidirectional,
    bandsKey,
    chartAxes,
    chartAxesKey,
    chartRef,
    compact,
    containerRef,
    dataRef,
    getXWindowRef,
    height,
    hiddenSeriesRef,
    hideYAxis,
    inlineLegend,
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
    seriesFills,
    seriesFillsKey,
    seriesFormattersRef,
    seriesRenders,
    seriesRendersKey,
    setLayoutDensity,
    showTooltip,
    sizeRef,
    sourceIndicesRef,
    stacked,
    syncKey,
    syncUnitInsetsRef,
    tooltipColumnSize,
    tooltipSort,
    xTime,
  ]);
}

export { useMetricChartInstance };
