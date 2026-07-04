import type { MetricTimeSeries } from "@/lib/api/metric-timeseries";
import { timeseriesToMetric } from "@/lib/api/metric-timeseries";
import type { SummaryPoint, TimeseriesResponse } from "@/lib/api/types";
import type { ChartDefinition, UnitKind } from "@/lib/metrics/charts/types";

export type CompareSeriesInput = {
  key: string;
  label: string;
  points: SummaryPoint[];
};

function unionTimestamps(series: CompareSeriesInput[]): number[] {
  const timestamps = new Set<number>();
  for (const entry of series) {
    for (const point of entry.points) {
      timestamps.add(point.timestamp);
    }
  }
  return [...timestamps].sort((left, right) => left - right);
}

function alignPoints(
  timestamps: number[],
  points: SummaryPoint[],
): Array<number | null> {
  const valueMap = new Map(points.map((point) => [point.timestamp, point.value]));
  return timestamps.map((timestamp) => valueMap.get(timestamp) ?? null);
}

export function compareSeriesToMetricTimeSeries(
  series: CompareSeriesInput[],
  from: number,
  to: number,
): MetricTimeSeries | null {
  if (series.length === 0) {
    return null;
  }

  const timestamps = unionTimestamps(series);
  if (timestamps.length === 0) {
    return null;
  }

  const aligned: Record<string, Array<number | null>> = {};
  for (const entry of series) {
    aligned[entry.key] = alignPoints(timestamps, entry.points);
  }

  return {
    from,
    to,
    step: null,
    timestamps,
    series: aligned,
  };
}

export function indexMetricTimeSeries(
  data: MetricTimeSeries,
): MetricTimeSeries {
  const series: Record<string, Array<number | null>> = {};

  for (const [key, values] of Object.entries(data.series)) {
    const start = values.find((value) => value != null && value !== 0);
    if (start == null || start === 0) {
      series[key] = values;
      continue;
    }
    series[key] = values.map((value) =>
      value == null ? null : (value / start) * 100,
    );
  }

  return { ...data, series };
}

export function appendTotalTimeseries(
  data: MetricTimeSeries,
  total: TimeseriesResponse,
): MetricTimeSeries {
  const totalMetric = timeseriesToMetric(total);
  const timestamps = new Set(data.timestamps);
  for (const timestamp of totalMetric.timestamps) {
    timestamps.add(timestamp);
  }
  const mergedTimestamps = [...timestamps].sort((left, right) => left - right);

  const remap = (
    sourceTimestamps: number[],
    values: Array<number | null>,
  ): Array<number | null> => {
    const valueMap = new Map(
      sourceTimestamps.map((timestamp, index) => [
        timestamp,
        values[index] ?? null,
      ]),
    );
    return mergedTimestamps.map((timestamp) => valueMap.get(timestamp) ?? null);
  };

  const series: Record<string, Array<number | null>> = {};
  for (const [key, values] of Object.entries(data.series)) {
    series[key] = remap(data.timestamps, values);
  }

  const totalValues = totalMetric.series.players_online;
  series.total_players = remap(totalMetric.timestamps, totalValues);

  return {
    from: Math.min(data.from, totalMetric.from),
    to: Math.max(data.to, totalMetric.to),
    step: null,
    timestamps: mergedTimestamps,
    series,
  };
}

export function buildCompareChartDefinition(
  series: CompareSeriesInput[],
  options: {
    id: string;
    indexed: boolean;
    includeTotal: boolean;
  },
): ChartDefinition {
  const yUnit: UnitKind = options.indexed ? "percent" : "count";

  const chartSeries = series.map((entry) => ({
    key: entry.key,
    label: entry.label,
    unit: yUnit,
    axis: "left",
    render: "line" as const,
    fill: false,
  }));

  if (options.includeTotal) {
    chartSeries.push({
      key: "total_players",
      label: "All tracked",
      unit: yUnit,
      axis: "left",
      render: "line" as const,
      fill: false,
    });
  }

  return {
    id: options.id,
    title: "",
    series: chartSeries,
    axes: {
      left: { unit: yUnit, yRange: options.indexed ? "auto" : "autoMin" },
    },
  };
}
