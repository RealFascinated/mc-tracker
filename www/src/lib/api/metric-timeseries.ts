import type { TimeseriesLane, TimeseriesResponse } from "@/lib/api/types";
import { TIMESERIES_SERIES_KEYS } from "@/lib/api/types";

export type MetricTimeSeries = {
  from: number;
  to: number;
  step: number | null;
  timestamps: number[];
  series: Record<string, Array<number | null>>;
};

export const EMPTY_METRIC_TIME_SERIES: MetricTimeSeries = {
  from: 0,
  to: 0,
  step: null,
  timestamps: [],
  series: {},
};

const CHART_SERIES_KEYS: Record<string, string> = {
  [TIMESERIES_SERIES_KEYS.playersOnline]: "players_online",
};

function buildMetricTimeGrid(from: number, to: number, step: number): number[] {
  const start = Math.trunc(from / step) * step;
  const timestamps: number[] = [];
  for (let timestamp = start; timestamp <= to; timestamp += step) {
    timestamps.push(timestamp);
  }
  return timestamps;
}

function backfillLane(
  from: number,
  to: number,
  lane: TimeseriesLane,
): { timestamps: number[]; values: Array<number | null> } {
  const timestamps = buildMetricTimeGrid(from, to, lane.step);
  if (timestamps.length === 0) {
    return { timestamps: lane.timestamps, values: lane.values };
  }

  const valueMap = new Map<number, number | null>();
  lane.timestamps.forEach((timestamp, index) => {
    valueMap.set(timestamp, lane.values[index] ?? null);
  });

  return {
    timestamps,
    values: timestamps.map((timestamp) => valueMap.get(timestamp) ?? null),
  };
}

export function timeseriesToMetric(data: TimeseriesResponse): MetricTimeSeries {
  const lanes = Object.entries(data.series);
  if (lanes.length === 0) {
    return {
      from: data.from,
      to: data.to,
      step: null,
      timestamps: [],
      series: {},
    };
  }

  const backfilled = lanes.map(([apiKey, lane]) => {
    const filled = backfillLane(data.from, data.to, lane);
    return {
      chartKey: CHART_SERIES_KEYS[apiKey] ?? apiKey,
      ...filled,
    };
  });

  const timestampSet = new Set<number>();
  for (const lane of backfilled) {
    for (const timestamp of lane.timestamps) {
      timestampSet.add(timestamp);
    }
  }
  const timestamps = [...timestampSet].sort((left, right) => left - right);

  const series: Record<string, Array<number | null>> = {};
  for (const lane of backfilled) {
    const valueMap = new Map(
      lane.timestamps.map((timestamp, index) => [
        timestamp,
        lane.values[index] ?? null,
      ]),
    );
    series[lane.chartKey] = timestamps.map(
      (timestamp) => valueMap.get(timestamp) ?? null,
    );
  }

  const step = lanes.length === 1 ? (lanes[0]?.[1].step ?? null) : null;

  return {
    from: data.from,
    to: data.to,
    step,
    timestamps,
    series,
  };
}
