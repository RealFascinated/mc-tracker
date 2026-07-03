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
  [TIMESERIES_SERIES_KEYS.playersDailyAvg]: "players_daily_avg",
};

const DAY_SECONDS = 86_400;

function utcDay(timestamp: number): number {
  return Math.floor(timestamp / DAY_SECONDS);
}

/** Place one daily-avg marker per UTC day on the shared chart timeline. */
function placeDailyAvgOnChartGrid(
  timestamps: number[],
  dailyLane: { timestamps: number[]; values: Array<number | null> },
): Array<number | null> {
  const dailyByDay = new Map<number, number>();
  for (let i = 0; i < dailyLane.timestamps.length; i++) {
    const value = dailyLane.values[i];
    if (value == null) continue;
    dailyByDay.set(utcDay(dailyLane.timestamps[i]), value);
  }

  const indicesByDay = new Map<number, number[]>();
  timestamps.forEach((timestamp, index) => {
    const day = utcDay(timestamp);
    if (!dailyByDay.has(day)) return;
    const indices = indicesByDay.get(day) ?? [];
    indices.push(index);
    indicesByDay.set(day, indices);
  });

  const result = timestamps.map(() => null as number | null);
  for (const [day, indices] of indicesByDay) {
    const value = dailyByDay.get(day);
    if (value == null || indices.length === 0) continue;

    const noon = day * DAY_SECONDS + DAY_SECONDS / 2;
    let anchor = indices[0];
    let bestDistance = Math.abs(timestamps[anchor] - noon);
    for (const index of indices.slice(1)) {
      const distance = Math.abs(timestamps[index] - noon);
      if (distance < bestDistance) {
        anchor = index;
        bestDistance = distance;
      }
    }

    result[anchor] = value;
  }

  return result;
}

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
    if (
      lane.chartKey ===
      CHART_SERIES_KEYS[TIMESERIES_SERIES_KEYS.playersDailyAvg]
    ) {
      series[lane.chartKey] = placeDailyAvgOnChartGrid(timestamps, lane);
      continue;
    }

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
