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
} as const;

export type ApiErrorCode =
  | "invalidRange"
  | "noData"
  | "serverNotFound"
  | "asnNotFound"
  | "notFound"
  | "badRequest"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "tooManyRequests"
  | "internalError";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
};

export type ErrorTarget =
  | { kind: "server"; id: string }
  | { kind: "asn"; asn: string; asnOrg: string };

export type PartialError = {
  code: ApiErrorCode;
  message: string;
  target: ErrorTarget;
};

export type ServersCompareResponse = {
  servers: ServerTimeseriesSummaryResponse[];
  errors: PartialError[];
};

export type TrendDirection = "growing" | "stable" | "declining" | "unknown";

export type SummaryPoint = {
  timestamp: number;
  value: number;
};

export type TimeseriesSummaryResponse = {
  from: number;
  to: number;
  seriesKey: string;
  start: number | null;
  end: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  changePct: number | null;
  trend: TrendDirection;
  points: SummaryPoint[];
};

export type ServerTimeseriesSummaryResponse = TimeseriesSummaryResponse & {
  id: string;
  name: string;
};

export type AsnTimeseriesSummaryResponse = TimeseriesSummaryResponse & {
  asn: string;
  asnOrg: string;
};
