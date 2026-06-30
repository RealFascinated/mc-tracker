import type { MetricTimeSeries } from "@/lib/api/metric-timeseries";
import type {
  AxisDefinition,
  AxisRenderConfig,
  ChartDefinition,
  YRangeSpec,
} from "@/lib/metrics/charts/types";
import type { ChartSeries, MetricValues } from "@/lib/metrics/series";
import type { ChartYRange } from "@/lib/metrics/uplot-theme";
import {
  hasSeriesData,
  hasValues,
  chartYMax,
  yMaxWithSoftMax,
} from "@/lib/metrics/series";
import { unitFormatter } from "@/lib/metrics/units";

export type BuiltChartConfig = {
  id: string;
  title: string;
  timestamps: Array<number>;
  series: Array<ChartSeries>;
  axes: Array<AxisRenderConfig>;
  seriesFormatters: Array<(value: number) => string>;
};

function resolveYRange(
  spec: YRangeSpec | undefined,
  values: Array<MetricValues>,
): ChartYRange {
  const finite = values.filter(
    (entry): entry is Array<number | null> => entry != null,
  );

  if (!spec || spec === "auto") {
    return { min: 0, max: chartYMax(...finite) };
  }

  if (spec === "autoMin") {
    return { autoMin: true };
  }

  if ("softMax" in spec) {
    const merged = finite.flat();
    return { min: 0, max: yMaxWithSoftMax(merged, spec.softMax) };
  }

  return { min: spec.min, max: spec.max };
}

function axisDefFor(
  def: ChartDefinition,
  axisId: string,
  seriesOnAxis: Array<ChartDefinition["series"][number]>,
): AxisDefinition {
  if (axisId in def.axes) return def.axes[axisId];

  const first = seriesOnAxis[0];
  return {
    unit: first.unit,
    yRange: "auto",
    side: axisId === "left" ? "left" : "right",
  };
}

export function buildChartConfig(
  def: ChartDefinition,
  data: MetricTimeSeries,
): BuiltChartConfig | null {
  const series: Array<ChartSeries> = [];
  const seriesFormatters: Array<(value: number) => string> = [];
  const valuesByAxis = new Map<string, Array<MetricValues>>();

  for (const entry of def.series) {
    const values = data.series[entry.key] ?? null;
    series.push({
      label: entry.label,
      values,
      axis: entry.axis,
      render: entry.render,
      color: entry.color,
      fill: entry.fill,
    });
    seriesFormatters.push(
      entry.valueFormatter ?? unitFormatter(entry.unit).formatValue,
    );

    const bucket = valuesByAxis.get(entry.axis) ?? [];
    bucket.push(values);
    valuesByAxis.set(entry.axis, bucket);
  }

  if (!hasSeriesData(series)) return null;

  const axisIds = [...new Set(def.series.map((entry) => entry.axis))];
  const axes: Array<AxisRenderConfig> = axisIds.map((axisId) => {
    const seriesOnAxis = def.series.filter((entry) => entry.axis === axisId);
    const axisDef = axisDefFor(def, axisId, seriesOnAxis);
    const side = axisDef.side ?? (axisId === "left" ? "left" : "right");

    return {
      id: axisId,
      format: unitFormatter(axisDef.unit),
      yRange: resolveYRange(axisDef.yRange, valuesByAxis.get(axisId) ?? []),
      side,
      visible: axisDef.visible ?? true,
    };
  });

  return {
    id: def.id,
    title: def.title,
    timestamps: data.timestamps,
    series,
    axes,
    seriesFormatters,
  };
}

export function chartHasData(
  data: MetricTimeSeries,
  def: ChartDefinition,
): boolean {
  return def.series.some((entry) => hasValues(data.series[entry.key] ?? null));
}
