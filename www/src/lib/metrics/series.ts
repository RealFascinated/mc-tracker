import type uPlot from "uplot";

import type { ChartSeriesColor } from "@/lib/metrics/charts/types";

export type MetricValues = Array<number | null> | null;
export type ChartAxis = string;

export type ChartSeriesRender = "line" | "bar";

export type ChartSeries = {
  label: string;
  values: MetricValues;
  negate?: boolean;
  axis?: ChartAxis;
  render?: ChartSeriesRender;
  color?: ChartSeriesColor;
  fill?: boolean;
};

export function chartYMax(...series: Array<MetricValues>): number {
  const samples = collectPositiveSamples(...series);
  if (samples.length === 0) return 1;
  const peak = Math.max(...samples);
  return Math.max(peak * 1.1, 1);
}

function collectPositiveSamples(...series: Array<MetricValues>): Array<number> {
  const samples: Array<number> = [];
  for (const values of series) {
    if (!values) continue;
    for (const v of values) {
      if (v != null && Number.isFinite(v) && v > 0) samples.push(v);
    }
  }
  return samples;
}

export function yMaxWithSoftMax(values: MetricValues, softMax: number): number {
  return Math.max(chartYMax(values), softMax);
}

function hasValues(values: MetricValues): boolean {
  if (!values || values.length === 0) return false;
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return true;
  }
  return false;
}

export function hasSeriesData(series: Array<ChartSeries>): boolean {
  return series.some((s) => hasValues(s.values));
}

export function getLatestValue(values: MetricValues): number | null {
  if (!values) return null;
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

function stackSortValue(series: ChartSeries): number {
  const v = getLatestValue(series.values);
  if (v == null) return Number.NEGATIVE_INFINITY;
  return series.negate ? Math.abs(v) : v;
}

export function sortSeriesForStack(
  series: Array<ChartSeries>,
): Array<ChartSeries> {
  return [...series].sort((a, b) => {
    const delta = stackSortValue(a) - stackSortValue(b);
    return delta !== 0 ? delta : a.label.localeCompare(b.label);
  });
}

export function buildMultiSeriesData(
  timestamps: Array<number>,
  series: Array<ChartSeries>,
): {
  data: uPlot.AlignedData;
  labels: Array<string>;
  negated: Array<boolean>;
  axes: Array<ChartAxis>;
  renders: Array<ChartSeriesRender>;
  sourceIndices: Array<number>;
} | null {
  const active: Array<{ entry: ChartSeries; index: number }> = [];
  for (const [index, entry] of series.entries()) {
    if (hasValues(entry.values)) {
      active.push({ entry, index });
    }
  }
  if (active.length === 0 || timestamps.length === 0) return null;

  if (active.some(({ entry }) => entry.render === "bar")) {
    active.sort((a, b) => {
      const aBar = a.entry.render === "bar" ? 0 : 1;
      const bBar = b.entry.render === "bar" ? 0 : 1;
      if (aBar !== bBar) return aBar - bBar;
      return a.index - b.index;
    });
  }

  const data: uPlot.AlignedData = [timestamps];
  const labels: Array<string> = [];
  const negated: Array<boolean> = [];
  const axes: Array<ChartAxis> = [];
  const renders: Array<ChartSeriesRender> = [];
  const sourceIndices: Array<number> = [];

  for (const { entry, index } of active) {
    const vals = entry.values!;
    const aligned =
      vals.length === timestamps.length
        ? vals
        : timestamps.map((_, i) => vals[i] ?? null);

    data.push(
      entry.negate ? aligned.map((v) => (v == null ? null : -v)) : aligned,
    );
    labels.push(entry.label);
    negated.push(entry.negate ?? false);
    axes.push(entry.axis ?? "left");
    renders.push(entry.render ?? "line");
    sourceIndices.push(index);
  }

  if (labels.length === 0) return null;
  return { data, labels, negated, axes, renders, sourceIndices };
}

export function stackAlignedData(data: uPlot.AlignedData): {
  data: uPlot.AlignedData;
  bands: Array<uPlot.Band>;
} {
  const pointCount = data[0].length;
  const accum = new Array<number>(pointCount).fill(0);
  const stackedSeries: Array<Array<number | null>> = [];

  for (let si = 1; si < data.length; si++) {
    const series = data[si] as Array<number | null>;
    const cumulative: Array<number | null> = [];

    for (let pi = 0; pi < pointCount; pi++) {
      const value = series[pi];
      if (value == null) {
        cumulative.push(accum[pi] === 0 ? null : accum[pi]);
      } else {
        accum[pi] += value;
        cumulative.push(accum[pi]);
      }
    }

    stackedSeries.push(cumulative);
  }

  const bands: Array<uPlot.Band> = [];
  for (let i = 1; i < data.length; i++) {
    bands.push({ series: [data.length - i - 1, data.length - i] });
  }

  return { data: [data[0], ...stackedSeries], bands };
}
