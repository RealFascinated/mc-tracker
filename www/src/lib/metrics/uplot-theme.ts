import uPlot from "uplot";
import type { ChartAxisFormat } from "@/lib/metrics/chart-axis-format";
import type { AxisRenderConfig } from "@/lib/metrics/charts/types";
import type { ChartSeriesRender } from "@/lib/metrics/series";
import { formatChartAxisTicks } from "@/lib/formatter";
import { readCssVar } from "@/lib/css-vars";
import { getChartColors } from "@/lib/metrics/chart-colors";

const COMPACT_LAYOUT_MAX_WIDTH = 640;

/** Cap retina backing store — full DPR on wide charts is a common scroll jank source. */
const CHART_MAX_PX_RATIO = 2;

export function chartPxRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  return Math.min(window.devicePixelRatio || 1, CHART_MAX_PX_RATIO);
}

export type ChartLayout = {
  density: "normal" | "compact";
  axisFont: string;
  axisMinWidth: number;
  axisGap: number;
  xAxisHeight: number;
  xAxisGap: number;
  xAxisSpace: number;
  paddingTop: number;
  paddingTopWithUnits: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  paddingRightDual: number;
};

const NORMAL_LAYOUT: ChartLayout = {
  density: "normal",
  axisFont:
    '12px "Geist Variable", Geist, ui-sans-serif, system-ui, sans-serif',
  axisMinWidth: 48,
  axisGap: 8,
  xAxisHeight: 24,
  xAxisGap: 4,
  xAxisSpace: 40,
  paddingTop: 20,
  paddingTopWithUnits: 28,
  paddingBottom: 18,
  paddingLeft: 10,
  paddingRight: 18,
  paddingRightDual: 12,
};

const COMPACT_LAYOUT: ChartLayout = {
  density: "compact",
  axisFont:
    '10px "Geist Variable", Geist, ui-sans-serif, system-ui, sans-serif',
  axisMinWidth: 30,
  axisGap: 4,
  xAxisHeight: 18,
  xAxisGap: 2,
  xAxisSpace: 56,
  paddingTop: 12,
  paddingTopWithUnits: 18,
  paddingBottom: 10,
  paddingLeft: 4,
  paddingRight: 8,
  paddingRightDual: 6,
};

export function chartLayoutForWidth(width: number): ChartLayout {
  return width > 0 && width < COMPACT_LAYOUT_MAX_WIDTH
    ? COMPACT_LAYOUT
    : NORMAL_LAYOUT;
}

export function chartLayoutForDensity(
  density: "normal" | "compact",
): ChartLayout {
  return density === "compact" ? COMPACT_LAYOUT : NORMAL_LAYOUT;
}

let textMeasureCtx: CanvasRenderingContext2D | null = null;

function measureAxisWidth(
  values: Array<string> | null,
  layout: ChartLayout,
): number {
  const minWidth = layout.axisMinWidth;
  if (!values || values.length === 0) return minWidth;

  if (!textMeasureCtx) {
    textMeasureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!textMeasureCtx) return minWidth;

  textMeasureCtx.font = layout.axisFont;
  let max = 0;
  for (const value of values) {
    max = Math.max(max, textMeasureCtx.measureText(value).width);
  }
  const tickPadding = layout.density === "compact" ? 8 : 14;
  const safetyMargin = 4;
  return Math.max(minWidth, Math.ceil(max) + tickPadding + safetyMargin);
}

export type ChartYRange = {
  min?: number;
  max?: number;
  autoMin?: boolean;
};

export type ChartXRange = {
  min: number;
  max: number;
};

function buildYScale(yRange?: ChartYRange, bidirectional = false): uPlot.Scale {
  if (bidirectional) {
    if (yRange?.max != null) {
      return { auto: false, range: [-yRange.max, yRange.max] };
    }
    return {
      range: (_self, dataMin, dataMax) => {
        const extent = Math.max(Math.abs(dataMin), Math.abs(dataMax), 1);
        const [, padded] = uPlot.rangeNum(-extent, extent, 0.1, true);
        const max = padded ?? extent;
        return [-max, max];
      },
    };
  }

  const autoMin = yRange?.autoMin ?? false;
  const yMin = yRange?.min ?? (autoMin ? undefined : 0);

  if (yRange?.max != null) {
    const yMax = yRange.max;
    if (yMin != null) {
      return { auto: false, range: [yMin, yMax] };
    }
    return {
      range: (_self, dataMin, dataMax) => {
        const [min] = uPlot.rangeNum(dataMin, dataMax, 0.1, true);
        return [min ?? dataMin, yMax];
      },
    };
  }

  if (autoMin) {
    return {
      range: (_self, dataMin, dataMax) => {
        const [min, max] = uPlot.rangeNum(dataMin, dataMax, 0.1, true);
        return [min ?? dataMin, max ?? dataMax];
      },
    };
  }

  const floor = yMin ?? 0;
  return {
    range: (_self, dataMin, dataMax) => {
      const [min, max] = uPlot.rangeNum(dataMin, dataMax, 0.1, true);
      return [Math.min(floor, min ?? floor), Math.max(floor, max ?? floor + 1)];
    },
  };
}

function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith("#") || (color.length !== 7 && color.length !== 4)) {
    return color;
  }
  if (color.length === 4) {
    const r = color[1],
      g = color[2],
      b = color[3];
    return `rgba(${Number.parseInt(`${r}${r}`, 16)}, ${Number.parseInt(`${g}${g}`, 16)}, ${Number.parseInt(`${b}${b}`, 16)}, ${alpha})`;
  }
  const r = Number.parseInt(color.slice(1, 3), 16);
  const g = Number.parseInt(color.slice(3, 5), 16);
  const b = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildGradientFill(
  color: string,
): (u: uPlot, seriesIdx: number) => CanvasGradient {
  return (u: uPlot, seriesIdx: number) => {
    const ctx = u.ctx;
    const series = u.series[seriesIdx];
    const scaleKey = series.scale ?? "y";
    const scale = u.scales[scaleKey];
    const topVal = scale.max ?? series.max ?? 0;
    const baseVal = scale.min ?? 0;
    const lineY = u.valToPos(topVal, scaleKey, true);
    const baseY = u.valToPos(baseVal, scaleKey, true);

    const gradient = ctx.createLinearGradient(0, lineY, 0, baseY);
    gradient.addColorStop(0, withAlpha(color, 0.35));
    gradient.addColorStop(0.55, withAlpha(color, 0.12));
    gradient.addColorStop(1, withAlpha(color, 0.02));
    return gradient;
  };
}

type BuildUPlotOptionsParams = {
  labels: Array<string>;
  height: number;
  chartAxes: Array<AxisRenderConfig>;
  seriesAxisIds: Array<string>;
  seriesFormatters?: Array<(value: number) => string>;
  xRange?: ChartXRange;
  seriesRenders?: Array<ChartSeriesRender>;
  stacked?: boolean;
  bands?: Array<uPlot.Band>;
  bidirectional?: boolean;
  negated?: Array<boolean>;
  compact?: boolean;
  hideYAxis?: boolean;
  xTime?: boolean;
  reserveUnitLabels?: boolean;
  layout?: ChartLayout;
  seriesColors?: Array<string>;
  seriesFills?: Array<boolean | undefined>;
  xDrag?: boolean;
  /** Legend row sits directly above the plot; use tighter top padding. */
  inlineLegend?: boolean;
};

const SCALE_KEYS = ["y", "y2", "y3", "y4", "y5"] as const;

function axisScaleMap(chartAxes: Array<AxisRenderConfig>): Map<string, string> {
  const map = new Map<string, string>();
  chartAxes.forEach((axis, index) => {
    map.set(axis.id, SCALE_KEYS[index] ?? `y${index + 1}`);
  });
  return map;
}

function buildAxisTickValues(
  scaleKey: string,
  axisFormat: ChartAxisFormat,
  bidirectional: boolean,
): uPlot.Axis["values"] {
  return (self, ticks) => {
    const rangeMax = Math.abs(self.scales[scaleKey].max ?? ticks.at(-1) ?? 1);
    return ticks.map((tick) => {
      const display = bidirectional ? Math.abs(tick) : tick;
      return axisFormat.formatAxisTick(display, rangeMax);
    });
  };
}

function measuredAxisWidth(
  axis: uPlot.Axis | undefined,
  fallback: number,
): number {
  if (!axis) return 0;
  const size = (axis as uPlot.Axis & { _size?: number })._size ?? 0;
  return size > 0 ? size : fallback;
}

export function readAxisUnitInsets(
  u: uPlot,
  chartAxes: Array<AxisRenderConfig>,
  layout?: ChartLayout,
): { left: number; right: number } {
  const resolvedLayout = layout ?? chartLayoutForWidth(u.width);
  if (resolvedLayout.density === "compact") {
    return { left: 2, right: 2 };
  }

  const { bbox, width } = u;
  const scales = axisScaleMap(chartAxes);
  const leftAxisId = chartAxes.find(
    (axis) => axis.side === "left" && axis.visible,
  )?.id;
  const rightAxisId = chartAxes.find(
    (axis) => axis.side === "right" && axis.visible,
  )?.id;
  const leftScale = leftAxisId ? scales.get(leftAxisId) : "y";
  const rightScale = rightAxisId ? scales.get(rightAxisId) : undefined;

  const leftAxis = u.axes.find(
    (entry) => entry.scale === leftScale && entry.show !== false,
  );
  const rightAxis = rightScale
    ? u.axes.find((entry) => entry.scale === rightScale)
    : undefined;

  const leftGutter = leftAxis
    ? measuredAxisWidth(leftAxis, resolvedLayout.paddingLeft)
    : resolvedLayout.paddingLeft;
  const rightHidden = !rightAxis || rightAxis.show === false;
  const rightGutter = rightHidden
    ? resolvedLayout.paddingRight
    : measuredAxisWidth(rightAxis, resolvedLayout.paddingRightDual);

  return {
    left: bbox.left - leftGutter + 4,
    right: width - (bbox.left + bbox.width + rightGutter - 4),
  };
}

function chartThemeColors(): { axisColor: string; gridColor: string } {
  return {
    axisColor: readCssVar("--muted-foreground"),
    gridColor: readCssVar("--border"),
  };
}

function buildAxisConfig({
  axisColor,
  gridColor,
  showGrid,
  values,
  layout,
}: {
  axisColor: string;
  gridColor: string;
  showGrid: boolean;
  values: uPlot.Axis["values"];
  layout: ChartLayout;
}): uPlot.Axis {
  return {
    stroke: axisColor,
    font: layout.axisFont,
    gap: layout.axisGap,
    size: (_self, tickValues) => measureAxisWidth(tickValues, layout),
    grid: showGrid ? { stroke: gridColor } : { show: false },
    ticks: { stroke: axisColor },
    values,
  };
}

export function buildUPlotOptions({
  labels,
  height,
  chartAxes,
  seriesAxisIds,
  seriesFormatters = [],
  xRange,
  seriesRenders = [],
  stacked = false,
  bands,
  bidirectional = false,
  negated = [],
  compact = false,
  hideYAxis = false,
  xTime = true,
  reserveUnitLabels = false,
  layout = NORMAL_LAYOUT,
  seriesColors,
  seriesFills,
  xDrag = false,
  inlineLegend = false,
}: BuildUPlotOptionsParams): uPlot.Options {
  const colors = getChartColors();
  const { gridColor, axisColor } = chartThemeColors();
  const scales = axisScaleMap(chartAxes);
  const axisById = new Map(chartAxes.map((axis) => [axis.id, axis]));
  const hasVisibleRight = chartAxes.some(
    (axis) => axis.side === "right" && axis.visible,
  );

  function seriesScale(axisId: string | undefined): string {
    if (!axisId) return "y";
    return scales.get(axisId) ?? "y";
  }

  const yScales: uPlot.Scales = {
    x: xRange
      ? { time: xTime, auto: false, min: xRange.min, max: xRange.max }
      : { time: xTime },
  };

  for (const axis of chartAxes) {
    const scaleKey = scales.get(axis.id)!;
    yScales[scaleKey] = buildYScale(axis.yRange, bidirectional);
  }

  const yAxisConfigs = chartAxes.map((axis, index) => {
    const scaleKey = scales.get(axis.id)!;
    const showGrid = index === 0 && axis.visible;
    if (compact || !axis.visible) {
      return {
        show: false,
        scale: scaleKey,
        side: axis.side === "right" ? 1 : 3,
        size: 0,
        grid: { show: false },
        ticks: { show: false },
      } satisfies uPlot.Axis;
    }

    return {
      ...buildAxisConfig({
        axisColor,
        gridColor,
        showGrid,
        values: buildAxisTickValues(scaleKey, axis.format, bidirectional),
        layout,
      }),
      scale: scaleKey,
      side: axis.side === "right" ? 1 : 3,
    } satisfies uPlot.Axis;
  });

  return {
    width: 0,
    height,
    series: [
      { show: false },
      ...labels.map((label, index) => {
        const color = seriesColors?.[index] ?? colors[index % colors.length];
        const render = seriesRenders[index] ?? "line";
        const isBar = render === "bar";
        const isPoints = render === "points";
        const axisId = seriesAxisIds[index];
        const axis = axisId ? axisById.get(axisId) : undefined;
        const strokeOnly =
          !isBar && !isPoints && seriesFills?.[index] === false;
        const pointSize = layout.density === "compact" ? 9 : 12;

        const drawBars = uPlot.paths.bars;

        return {
          label,
          scale: seriesScale(axisId),
          stroke: color,
          ...(isBar
            ? {
                paths: drawBars?.({ size: [1, Infinity], radius: 0.12 }),
                fill: withAlpha(color, 0.12),
                width: 0,
                points: { show: false },
              }
            : isPoints
              ? {
                  width: 0,
                  fill: "transparent",
                  points: {
                    show: true,
                    size: pointSize,
                    stroke: color,
                    fill: color,
                    width: 2,
                  },
                }
              : {
                  fill: strokeOnly
                    ? "transparent"
                    : stacked
                      ? withAlpha(color, 0.35)
                      : buildGradientFill(color),
                  width: strokeOnly ? 2 : stacked ? 1 : 1.5,
                  points: { show: false },
                }),
          spanGaps: false,
          value: (
            _self: uPlot,
            rawValue: number | null,
            seriesIndex: number,
          ) => {
            if (rawValue == null) return "—";
            const display =
              (negated[seriesIndex - 1] ?? false)
                ? Math.abs(rawValue)
                : rawValue;
            const formatter =
              seriesFormatters.at(seriesIndex - 1) ?? axis?.format.formatValue;
            return formatter?.(display) ?? String(display);
          },
        };
      }),
    ],
    axes: compact
      ? [{ show: false }, { show: false }]
      : [
          {
            stroke: axisColor,
            font: layout.axisFont,
            gap: layout.xAxisGap,
            size: layout.xAxisHeight,
            space: layout.xAxisSpace,
            grid: { stroke: gridColor },
            ticks: {
              stroke: axisColor,
              size: layout.density === "compact" ? 3 : 4,
            },
            values: xTime
              ? (_self, splits, _axisIdx, _foundSpace, foundIncr) =>
                  formatChartAxisTicks(splits, foundIncr)
              : (_self, splits) => splits.map((tick) => `${Math.round(tick)}%`),
          },
          ...(hideYAxis
            ? [
                {
                  show: false,
                  scale: "y",
                  side: 3,
                  size: 0,
                  grid: { show: false },
                  ticks: { show: false },
                },
              ]
            : yAxisConfigs),
        ],
    legend: { show: false },
    bands,
    cursor: {
      show: !compact,
      drag: { x: xDrag, y: false, setScale: !xDrag },
      focus: {
        prox: seriesRenders.some((render) => render === "points") ? 40 : 24,
      },
    },
    scales: yScales,
    padding: compact
      ? [2, 0, 2, 0]
      : [
          inlineLegend
            ? 6
            : reserveUnitLabels
              ? layout.paddingTopWithUnits
              : layout.paddingTop,
          hasVisibleRight ? layout.paddingRightDual : layout.paddingRight,
          layout.paddingBottom,
          layout.paddingLeft,
        ],
  };
}

export function applyChartAxisScales(
  chart: uPlot,
  chartAxes: Array<AxisRenderConfig>,
  bidirectional = false,
): void {
  const scales = axisScaleMap(chartAxes);

  for (const axis of chartAxes) {
    const scaleKey = scales.get(axis.id)!;
    const yRange = axis.yRange;

    if (bidirectional) {
      if (yRange.max != null) {
        chart.setScale(scaleKey, { min: -yRange.max, max: yRange.max });
      }
      continue;
    }

    const autoMin = yRange.autoMin ?? false;
    const yMin = yRange.min ?? (autoMin ? undefined : 0);

    if (yRange.max != null) {
      if (yMin != null) {
        chart.setScale(scaleKey, { min: yMin, max: yRange.max });
      } else {
        const currentMin = chart.scales[scaleKey].min ?? 0;
        chart.setScale(scaleKey, { min: currentMin, max: yRange.max });
      }
      continue;
    }

    if (autoMin) {
      continue;
    }
  }
}
