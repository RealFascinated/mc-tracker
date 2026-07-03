type PeakPlayersRecord = {
  players: number;
  timestamp: number;
};

export type PlayersPeakSummary = {
  players24h: number | null;
  players7d: number | null;
};

export type EntityPeakStats = {
  players24h: number | null;
  allTime: PeakPlayersRecord | null;
};

export type PlayersSummaryBase = {
  totalPlayers: number;
  playersPc: number;
  playersPe: number;
  peaks: PlayersPeakSummary;
};

export type TimeseriesLane = {
  step: number;
  timestamps: number[];
  values: Array<number | null>;
};

export type TimeseriesResponse = {
  from: number;
  to: number;
  series: Record<string, TimeseriesLane>;
};

export const TIMESERIES_SERIES_KEYS = {
  playersOnline: "playersOnline",
  playersDailyAvg: "playersDailyAvg",
} as const;
