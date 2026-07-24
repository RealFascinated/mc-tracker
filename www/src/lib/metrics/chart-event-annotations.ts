import type uPlot from "uplot";

import type { MonitoredServerEvent } from "@/lib/api/monitored-server-events";
import { formatMonitoredServerEventLabel } from "@/lib/api/monitored-server-events";
import { readCssVar } from "@/lib/css-vars";

/** How close the cursor must be to show the annotation label. */
export const CHART_EVENT_ANNOTATION_HOVER_THRESHOLD_PX = 24;
/** Wider zone where the series tooltip yields to annotations. */
export const CHART_EVENT_ANNOTATION_TOOLTIP_SUPPRESS_PX = 32;
/** Annotations closer than this are merged into one tooltip. */
export const CHART_EVENT_ANNOTATION_MERGE_THRESHOLD_PX = 28;

export type ChartEventAnnotation = {
  timestamp: number;
  label: string;
  eventType: MonitoredServerEvent["eventType"];
};

export type ChartEventAnnotationHover = {
  annotations: ChartEventAnnotation[];
  position: { left: number; top: number };
};

export function serverEventsToAnnotations(
  events: MonitoredServerEvent[],
): ChartEventAnnotation[] {
  return events.map((event) => ({
    timestamp: event.occurredAt,
    label: formatMonitoredServerEventLabel(event),
    eventType: event.eventType,
  }));
}

export function getChartEventAnnotationColor(
  eventType: ChartEventAnnotation["eventType"],
): string {
  switch (eventType) {
    case "added":
      return readCssVar("--monitor");
    case "removed":
      return readCssVar("--destructive");
    case "paused":
      return readCssVar("--warning");
    case "unpaused":
      return readCssVar("--chart-2");
  }
}

/** Plot-relative x in CSS pixels (matches uPlot cursor.left). */
function getAnnotationPlotX(chart: uPlot, timestamp: number): number {
  return chart.valToPos(timestamp, "x", false);
}

function clientXToPlotX(chart: uPlot, clientX: number): number {
  const chartRect = chart.root.getBoundingClientRect();
  return clientX - chartRect.left - chart.bbox.left;
}

function chartEventAnnotationViewportPosition(
  chart: uPlot,
  plotX: number,
): { left: number; top: number } {
  const chartRect = chart.root.getBoundingClientRect();

  return {
    left: chartRect.left + chart.bbox.left + plotX,
    top: chartRect.top + chart.bbox.top + chart.bbox.height / 2,
  };
}

function clusterNearbyChartEventAnnotations(
  chart: uPlot,
  annotations: ChartEventAnnotation[],
  seed: ChartEventAnnotation,
  mergeThresholdPx: number,
): ChartEventAnnotation[] {
  const plotXByAnnotation = new Map(
    annotations.map((annotation) => [
      annotation,
      getAnnotationPlotX(chart, annotation.timestamp),
    ]),
  );
  const clustered = new Set<ChartEventAnnotation>([seed]);
  let expanded = true;

  while (expanded) {
    expanded = false;
    for (const annotation of annotations) {
      if (clustered.has(annotation)) {
        continue;
      }

      const plotX = plotXByAnnotation.get(annotation)!;
      for (const member of clustered) {
        const memberPlotX = plotXByAnnotation.get(member)!;
        if (Math.abs(plotX - memberPlotX) <= mergeThresholdPx) {
          clustered.add(annotation);
          expanded = true;
          break;
        }
      }
    }
  }

  return [...clustered].sort((a, b) => a.timestamp - b.timestamp);
}

/** Nearest annotation within hover range, plus any others close enough to merge. */
export function findHoveredChartEventAnnotations(
  chart: uPlot,
  annotations: ChartEventAnnotation[],
  clientX: number,
  hoverThresholdPx = CHART_EVENT_ANNOTATION_HOVER_THRESHOLD_PX,
  mergeThresholdPx = CHART_EVENT_ANNOTATION_MERGE_THRESHOLD_PX,
): ChartEventAnnotationHover | null {
  if (annotations.length === 0) {
    return null;
  }

  const localX = clientXToPlotX(chart, clientX);
  let nearest: ChartEventAnnotation | null = null;
  let nearestDistance = hoverThresholdPx;

  for (const annotation of annotations) {
    const distance = Math.abs(
      getAnnotationPlotX(chart, annotation.timestamp) - localX,
    );
    if (distance <= nearestDistance) {
      nearest = annotation;
      nearestDistance = distance;
    }
  }

  if (!nearest) {
    return null;
  }

  const cluster = clusterNearbyChartEventAnnotations(
    chart,
    annotations,
    nearest,
    mergeThresholdPx,
  );
  const averagePlotX =
    cluster.reduce(
      (sum, annotation) =>
        sum + getAnnotationPlotX(chart, annotation.timestamp),
      0,
    ) / cluster.length;

  return {
    annotations: cluster,
    position: chartEventAnnotationViewportPosition(chart, averagePlotX),
  };
}

export function findNearestChartEventAnnotation(
  chart: uPlot,
  annotations: ChartEventAnnotation[],
  clientX: number,
  thresholdPx = CHART_EVENT_ANNOTATION_HOVER_THRESHOLD_PX,
): ChartEventAnnotation | null {
  return (
    findHoveredChartEventAnnotations(chart, annotations, clientX, thresholdPx)
      ?.annotations[0] ?? null
  );
}

export function createEventAnnotationDrawHook(
  getAnnotations: () => ChartEventAnnotation[],
): (self: uPlot) => void {
  return (chart: uPlot) => {
    const annotations = getAnnotations();
    if (annotations.length === 0) {
      return;
    }

    const { ctx } = chart;
    const top = chart.bbox.top;
    const bottom = top + chart.bbox.height;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.9;

    for (const annotation of annotations) {
      const plotX = getAnnotationPlotX(chart, annotation.timestamp);
      if (plotX < 0 || plotX > chart.bbox.width) {
        continue;
      }

      const x = chart.valToPos(annotation.timestamp, "x", true);
      const color = getChartEventAnnotationColor(annotation.eventType);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, top + 8);
      ctx.lineTo(x - 6, top);
      ctx.lineTo(x + 6, top);
      ctx.closePath();
      ctx.fill();
      ctx.setLineDash([5, 4]);
    }

    ctx.restore();
  };
}
