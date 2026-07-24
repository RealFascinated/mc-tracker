import type uPlot from "uplot";

import type { MonitoredServerEvent } from "@/lib/api/monitored-server-events";
import { formatMonitoredServerEventLabel } from "@/lib/api/monitored-server-events";
import { readCssVar } from "@/lib/css-vars";

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

function annotationColor(
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

export function findNearestChartEventAnnotation(
  chart: uPlot,
  annotations: ChartEventAnnotation[],
  clientX: number,
  thresholdPx = 8,
): ChartEventAnnotation | null {
  if (annotations.length === 0) {
    return null;
  }

  const rect = chart.over.getBoundingClientRect();
  const localX = clientX - rect.left;
  let nearest: ChartEventAnnotation | null = null;
  let nearestDistance = thresholdPx;

  for (const annotation of annotations) {
    const x = chart.valToPos(annotation.timestamp, "x", true);
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
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (const annotation of annotations) {
      const x = chart.valToPos(annotation.timestamp, "x", true);
      if (x < chart.bbox.left || x > chart.bbox.left + chart.bbox.width) {
        continue;
      }

      const color = annotationColor(annotation.eventType);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, top + 6);
      ctx.lineTo(x - 4, top);
      ctx.lineTo(x + 4, top);
      ctx.closePath();
      ctx.fill();
      ctx.setLineDash([4, 4]);
    }

    ctx.restore();
  };
}
