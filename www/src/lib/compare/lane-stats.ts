import type { SummaryPoint, TimeseriesLane } from "@/lib/api/types";
import { TIMESERIES_SERIES_KEYS } from "@/lib/api/types";

export type LaneStats = {
  start: number | null;
  end: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  changePct: number | null;
};

export function statsFromLane(lane: TimeseriesLane): LaneStats {
  const nums: number[] = [];
  for (const value of lane.values) {
    if (value != null) {
      nums.push(value);
    }
  }

  if (nums.length === 0) {
    return {
      start: null,
      end: null,
      avg: null,
      min: null,
      max: null,
      changePct: null,
    };
  }

  const start = nums[0];
  const end = nums[nums.length - 1];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((sum, value) => sum + value, 0) / nums.length;
  const changePct =
    nums.length >= 2 && Math.abs(start) > Number.EPSILON
      ? ((end - start) / start) * 100
      : null;

  return { start, end, avg, min, max, changePct };
}

export function pointsFromLane(lane: TimeseriesLane): SummaryPoint[] {
  const points: SummaryPoint[] = [];
  for (let index = 0; index < lane.timestamps.length; index += 1) {
    const value = lane.values[index];
    if (value == null) {
      continue;
    }
    points.push({ timestamp: lane.timestamps[index], value });
  }
  return points;
}

export function playersOnlineLane(
  series: Record<string, TimeseriesLane>,
): TimeseriesLane | null {
  return series[TIMESERIES_SERIES_KEYS.playersOnline] ?? null;
}
