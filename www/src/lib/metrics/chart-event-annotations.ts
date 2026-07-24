import type uPlot from "uplot";

import type { MonitoredServerEvent } from "@/lib/api/monitored-server-events";
import { formatMonitoredServerEventLabel } from "@/lib/api/monitored-server-events";
import { readCssVar } from "@/lib/css-vars";

/** How close the cursor must be to show the annotation label. */
export const CHART_EVENT_ANNOTATION_HOVER_THRESHOLD_PX = 24;
/** Wider zone where the series tooltip yields to annotations. */
export const CHART_EVENT_ANNOTATION_TOOLTIP_SUPPRESS_PX = 32;

export type ChartEventAnnotation = {
  timestamp: number;
  label: string;
  eventType: MonitoredServerEvent["eventType"];
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

export function getChartEventAnnotationTooltipPosition(
  chart: uPlot,
  annotation: ChartEventAnnotation,
): { left: number; top: number } {
  const chartRect = chart.root.getBoundingClientRect();
  const plotX = getAnnotationPlotX(chart, annotation.timestamp);

  return {
    left: chartRect.left + chart.bbox.left + plotX,
    top: chartRect.top + chart.bbox.top + chart.bbox.height / 2,
  };
}

export function findNearestChartEventAnnotation(
  chart: uPlot,
  annotations: ChartEventAnnotation[],
  clientX: number,
  thresholdPx = CHART_EVENT_ANNOTATION_HOVER_THRESHOLD_PX,
): ChartEventAnnotation | null {
  if (annotations.length === 0) {
    return null;
  }

  const localX = clientXToPlotX(chart, clientX);
  let nearest: ChartEventAnnotation | null = null;
  let nearestDistance = thresholdPx;

  for (const annotation of annotations) {
    const x = getAnnotationPlotX(chart, annotation.timestamp);
    const distance = Math.abs(x - localX);
    if (distance <= nearestDistance) {
      nearest = annotation;
      nearestDistance = distance;
    }
  }

  return nearest;
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
