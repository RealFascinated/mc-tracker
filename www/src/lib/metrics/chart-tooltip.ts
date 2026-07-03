import type uPlot from "uplot";

import type { ResolvedTheme } from "@/lib/theme/theme-context";
import type { TooltipSortEntry } from "@/lib/metrics/charts/types";
import type { ChartSeriesRender } from "@/lib/metrics/series";
import { formatPercentValue, formatTooltipTimestamp } from "@/lib/formatter";

const TOOLTIP_PADDING = 8;
const TOOLTIP_OFFSET_X = 20;
const VIEWPORT_PADDING = 8;
const TOOLTIP_MAX_WIDTH = 320;
const TOOLTIP_COLUMN_WIDTH = 132;
const MOBILE_BREAKPOINT = 768;
const HIDDEN_CURSOR_POS = -10;
const POINTS_SERIES_TOOLTIP_SNAP_PX = 22;

function getViewportBounds() {
  const visualViewport = window.visualViewport;
  const offsetLeft = visualViewport?.offsetLeft ?? 0;
  const offsetTop = visualViewport?.offsetTop ?? 0;
  const width = visualViewport?.width ?? window.innerWidth;
  const height = visualViewport?.height ?? window.innerHeight;

  return {
    left: offsetLeft + VIEWPORT_PADDING,
    top: offsetTop + VIEWPORT_PADDING,
    right: offsetLeft + width - VIEWPORT_PADDING,
    bottom: offsetTop + height - VIEWPORT_PADDING,
    width,
    maxWidth: Math.min(TOOLTIP_MAX_WIDTH, width - VIEWPORT_PADDING * 2),
  };
}

function isCompactViewport(viewportWidth: number): boolean {
  return viewportWidth < MOBILE_BREAKPOINT;
}

function clampVerticalPosition(
  y: number,
  tooltipHeight: number,
  viewport: ReturnType<typeof getViewportBounds>,
): number {
  return Math.max(viewport.top, Math.min(y, viewport.bottom - tooltipHeight));
}

function positionDesktopTooltip({
  cursorX,
  plotCenterX,
  plotTop,
  tooltipWidth,
  tooltipHeight,
  viewport,
}: {
  cursorX: number;
  plotCenterX: number;
  plotTop: number;
  tooltipWidth: number;
  tooltipHeight: number;
  viewport: ReturnType<typeof getViewportBounds>;
}): { x: number; y: number } {
  const cursorOnLeft = cursorX < plotCenterX;

  let x = cursorOnLeft
    ? cursorX + TOOLTIP_OFFSET_X
    : cursorX - tooltipWidth - TOOLTIP_OFFSET_X;

  if (x + tooltipWidth > viewport.right) {
    x = cursorX - tooltipWidth - TOOLTIP_OFFSET_X;
  } else if (x < viewport.left) {
    x = cursorX + TOOLTIP_OFFSET_X;
  }

  x = clampHorizontalPosition(x, tooltipWidth, viewport);

  const y = clampVerticalPosition(
    plotTop + TOOLTIP_PADDING,
    tooltipHeight,
    viewport,
  );
  return { x, y };
}

function clampHorizontalPosition(
  x: number,
  tooltipWidth: number,
  viewport: ReturnType<typeof getViewportBounds>,
): number {
  return Math.max(viewport.left, Math.min(x, viewport.right - tooltipWidth));
}

function positionTooltip({
  tooltip,
  tooltipWidth,
  tooltipHeight,
  cursorX,
  chartRect,
  plotTop,
  plotCenterX,
  viewport,
}: {
  tooltip: HTMLDivElement;
  tooltipWidth: number;
  tooltipHeight: number;
  cursorX: number;
  chartRect: DOMRect;
  plotTop: number;
  plotCenterX: number;
  viewport: ReturnType<typeof getViewportBounds>;
}) {
  let x: number;
  let y: number;

  if (isCompactViewport(viewport.width)) {
    x = clampHorizontalPosition(
      chartRect.left + (chartRect.width - tooltipWidth) / 2,
      tooltipWidth,
      viewport,
    );
    y = chartRect.bottom + TOOLTIP_PADDING;
    if (y + tooltipHeight > viewport.bottom) {
      y = chartRect.top - tooltipHeight - TOOLTIP_PADDING;
    }
    y = clampVerticalPosition(y, tooltipHeight, viewport);
  } else {
    ({ x, y } = positionDesktopTooltip({
      cursorX,
      plotCenterX,
      plotTop,
      tooltipWidth,
      tooltipHeight,
      viewport,
    }));
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

type TooltipEntry = {
  value: number;
  label: string;
  color: string;
  seriesIndex: number;
};

function renderTooltipRow(
  entry: TooltipEntry,
  formatValue: (value: number, seriesIndex: number) => string,
): string {
  const formatted = formatValue(entry.value, entry.seriesIndex);
  return (
    `<div class="flex items-center gap-2 py-0.5">` +
    `<span class="size-2 shrink-0 rounded-full" style="background:${entry.color}"></span>` +
    `<span class="truncate text-muted-foreground">${entry.label}</span>` +
    `<span class="ml-auto pl-3 font-medium whitespace-nowrap tabular-nums">${formatted}</span>` +
    `</div>`
  );
}

function chunkEntries(
  entries: Array<TooltipEntry>,
  columnSize: number,
): Array<Array<TooltipEntry>> {
  const columns: Array<Array<TooltipEntry>> = [];
  for (let i = 0; i < entries.length; i += columnSize) {
    columns.push(entries.slice(i, i + columnSize));
  }
  return columns;
}

function renderTooltipBody(
  entries: Array<TooltipEntry>,
  formatValue: (value: number, seriesIndex: number) => string,
  tooltipColumnSize?: number,
  tooltipSort?: (a: TooltipSortEntry, b: TooltipSortEntry) => number,
  seriesCount = entries.length,
): string {
  const useColumns =
    tooltipColumnSize != null && seriesCount > tooltipColumnSize;
  const ordered = tooltipSort
    ? [...entries].sort(tooltipSort)
    : [...entries].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  if (!useColumns) {
    return ordered
      .map((entry) => renderTooltipRow(entry, formatValue))
      .join("");
  }

  const columns = chunkEntries(ordered, tooltipColumnSize);
  return (
    `<div class="flex items-start gap-4">` +
    columns
      .map(
        (column) =>
          `<div class="min-w-0 shrink-0" style="width:${TOOLTIP_COLUMN_WIDTH}px">` +
          column.map((entry) => renderTooltipRow(entry, formatValue)).join("") +
          `</div>`,
      )
      .join("") +
    `</div>`
  );
}

function getTooltipMaxWidth(
  viewport: ReturnType<typeof getViewportBounds>,
  tooltipColumnSize?: number,
  entryCount = 0,
): number {
  if (tooltipColumnSize == null || entryCount <= tooltipColumnSize) {
    return viewport.maxWidth;
  }
  const columnCount = Math.ceil(entryCount / tooltipColumnSize);
  const desiredWidth =
    columnCount * TOOLTIP_COLUMN_WIDTH + Math.max(0, columnCount - 1) * 16 + 20;
  const availableWidth = viewport.width - VIEWPORT_PADDING * 2;
  return Math.min(availableWidth, desiredWidth);
}

function getUsedTotalFooter(
  entries: Array<{ label: string; value: number }>,
  formatValue: (value: number, seriesIndex: number) => string,
  seriesIndexByLabel: Map<string, number>,
): string | null {
  const used = entries.find((e) => e.label === "Used");
  const total = entries.find((e) => e.label === "Total");
  if (!used || !total || total.value <= 0) return null;

  const usedIndex = seriesIndexByLabel.get("Used") ?? 0;
  const totalIndex = seriesIndexByLabel.get("Total") ?? 0;
  const percent = (used.value / total.value) * 100;
  return `${formatValue(used.value, usedIndex)} of ${formatValue(total.value, totalIndex)} (${formatPercentValue(percent)})`;
}

function resolveTooltipSeriesValue(
  u: uPlot,
  values: Array<number | null>,
  timestamps: Array<number>,
  idx: number,
  render: ChartSeriesRender | undefined,
): number | null {
  if (render !== "points") {
    return values[idx] ?? null;
  }

  const cursorX = u.cursor.left;
  if (cursorX == null) return null;

  let bestValue: number | null = null;
  let bestDistance = POINTS_SERIES_TOOLTIP_SNAP_PX + 1;

  for (let i = 0; i < values.length; i++) {
    const candidate = values[i];
    if (candidate == null) continue;
    const pointX = u.valToPos(timestamps[i], "x");
    const distance = Math.abs(cursorX - pointX);
    if (distance > POINTS_SERIES_TOOLTIP_SNAP_PX || distance >= bestDistance) {
      continue;
    }
    bestDistance = distance;
    bestValue = candidate;
  }

  return bestValue;
}

type CreateCursorTooltipHandlerParams = {
  tooltip: HTMLDivElement;
  labels: Array<string>;
  colors: Array<string>;
  getData: () => uPlot.AlignedData;
  formatValue: (value: number, seriesIndex: number) => string;
  getTheme: () => ResolvedTheme;
  stacked?: boolean;
  tooltipColumnSize?: number;
  tooltipSort?: (a: TooltipSortEntry, b: TooltipSortEntry) => number;
  isSeriesHidden?: (seriesIndex: number) => boolean;
  seriesRenders?: Array<ChartSeriesRender>;
};

export function createCursorTooltipHandler({
  tooltip,
  labels,
  colors,
  getData,
  formatValue,
  getTheme,
  stacked = false,
  tooltipColumnSize,
  tooltipSort,
  isSeriesHidden,
  seriesRenders,
}: CreateCursorTooltipHandlerParams) {
  const useColumnLayout =
    tooltipColumnSize != null && labels.length > tooltipColumnSize;

  return (u: uPlot) => {
    applyChartTooltipTheme(tooltip, getTheme(), useColumnLayout);
    const { idx, left } = u.cursor;
    if (idx == null || left == null) {
      tooltip.style.display = "none";
      return;
    }

    const data = getData();
    const timestamps = data[0] as Array<number>;
    const timestamp = timestamps[idx];
    const rangeSeconds =
      timestamps.length > 1
        ? timestamps[timestamps.length - 1] - timestamps[0]
        : 0;

    const entries: Array<TooltipEntry> = [];
    for (let si = 0; si < labels.length; si++) {
      if (isSeriesHidden?.(si)) continue;
      const value = resolveTooltipSeriesValue(
        u,
        data[si + 1] as Array<number | null>,
        timestamps,
        idx,
        seriesRenders?.[si],
      );
      if (value == null) continue;
      entries.push({
        value,
        label: labels[si],
        color: colors[si % colors.length],
        seriesIndex: si,
      });
    }

    if (entries.length === 0) {
      tooltip.style.display = "none";
      return;
    }

    const stackTotal = stacked
      ? entries.reduce((sum, e) => sum + Math.abs(e.value), 0)
      : 0;

    const body = renderTooltipBody(
      entries,
      formatValue,
      tooltipColumnSize,
      tooltipSort,
      labels.length,
    );
    const rows = [body];

    const seriesIndexByLabel = new Map(labels.map((label, i) => [label, i]));
    const usedTotalFooter = getUsedTotalFooter(
      entries,
      formatValue,
      seriesIndexByLabel,
    );

    if (stacked && entries.length > 1 && stackTotal > 0) {
      const totalFormatted = formatValue(stackTotal, -1);
      rows.push(
        `<div class="mt-1 flex items-center justify-between border-t border-border pt-1">` +
          `<span class="text-muted-foreground">Total</span>` +
          `<span class="font-medium tabular-nums">${totalFormatted}</span>` +
          `</div>`,
      );
    } else if (usedTotalFooter) {
      rows.push(
        `<div class="mt-1 border-t border-border pt-1 text-muted-foreground">${usedTotalFooter}</div>`,
      );
    }

    tooltip.innerHTML =
      `<div class="mb-1 font-medium">${formatTooltipTimestamp(timestamp, rangeSeconds)}</div>` +
      rows.join("");

    const chartRect = u.root.getBoundingClientRect();
    const plotLeft = chartRect.left + u.bbox.left;
    const plotTop = chartRect.top + u.bbox.top;
    const plotCenterX = plotLeft + u.bbox.width / 2;
    const cursorX = plotLeft + left;

    const viewport = getViewportBounds();

    tooltip.style.display = "block";
    tooltip.style.transform = "none";
    tooltip.style.maxHeight = "";
    tooltip.style.maxWidth = `${getTooltipMaxWidth(viewport, tooltipColumnSize, labels.length)}px`;
    tooltip.style.left = "0";
    tooltip.style.top = "0";
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    positionTooltip({
      tooltip,
      tooltipWidth,
      tooltipHeight,
      cursorX,
      chartRect,
      plotTop,
      plotCenterX,
      viewport,
    });
  };
}

export function applyChartTooltipTheme(
  tooltip: HTMLDivElement,
  theme: ResolvedTheme,
  useColumnLayout = false,
): void {
  const isDark = theme === "dark";
  tooltip.className = [
    "pointer-events-none fixed z-50 rounded-snug border px-2.5 py-2 text-xs shadow-md",
    useColumnLayout ? "" : "max-w-xs",
    isDark
      ? "border-border bg-popover text-popover-foreground"
      : "border-border bg-card text-foreground",
  ]
    .filter(Boolean)
    .join(" ");
}

export function createChartTooltipElement(
  theme: ResolvedTheme,
): HTMLDivElement {
  const tooltip = document.createElement("div");
  applyChartTooltipTheme(tooltip, theme);
  tooltip.style.display = "none";
  document.body.appendChild(tooltip);
  return tooltip;
}

export function destroyChartTooltipElement(tooltip: HTMLDivElement) {
  tooltip.style.display = "none";
  tooltip.remove();
}

export function dismissChartInteraction(chart: uPlot, tooltip: HTMLDivElement) {
  tooltip.style.display = "none";
  chart.setCursor({ left: HIDDEN_CURSOR_POS, top: HIDDEN_CURSOR_POS }, true);
  chart.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
}

type ChartDismissBinding = { chart: uPlot; tooltip: HTMLDivElement };

const chartDismissBindings = new Set<ChartDismissBinding>();
const scrollListenerOptions: AddEventListenerOptions = {
  passive: true,
  capture: true,
};
const wheelListenerOptions: AddEventListenerOptions = { passive: true };
let globalScrollListenerAttached = false;

function onGlobalScrollDismiss() {
  for (const binding of chartDismissBindings) {
    if (binding.tooltip.style.display === "none") {
      continue;
    }
    dismissChartInteraction(binding.chart, binding.tooltip);
  }
}

function attachGlobalScrollDismissListener() {
  if (globalScrollListenerAttached) {
    return;
  }
  globalScrollListenerAttached = true;
  window.addEventListener(
    "scroll",
    onGlobalScrollDismiss,
    scrollListenerOptions,
  );
  document.addEventListener(
    "scroll",
    onGlobalScrollDismiss,
    scrollListenerOptions,
  );
}

function detachGlobalScrollDismissListener() {
  if (!globalScrollListenerAttached || chartDismissBindings.size > 0) {
    return;
  }
  window.removeEventListener(
    "scroll",
    onGlobalScrollDismiss,
    scrollListenerOptions,
  );
  document.removeEventListener(
    "scroll",
    onGlobalScrollDismiss,
    scrollListenerOptions,
  );
  globalScrollListenerAttached = false;
}

export function bindChartInteractionDismiss(
  chart: uPlot,
  tooltip: HTMLDivElement,
): () => void {
  const binding: ChartDismissBinding = { chart, tooltip };
  chartDismissBindings.add(binding);
  attachGlobalScrollDismissListener();

  const dismiss = () => dismissChartInteraction(chart, tooltip);
  chart.over.addEventListener("wheel", dismiss, wheelListenerOptions);

  return () => {
    chartDismissBindings.delete(binding);
    detachGlobalScrollDismissListener();
    chart.over.removeEventListener("wheel", dismiss, wheelListenerOptions);
  };
}
