import { apiFetch } from "@/lib/api/client";

export type PeakPlayersRecord = {
  players: number;
  timestamp: number;
};

export type PlayersPeakSummary = {
  players24h: number | null;
  players30d: number | null;
  players7d: number | null;
  allTime: PeakPlayersRecord | null;
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

export type PlayersTimeseriesPayload = {
  from: number;
  to: number;
  step: number;
  timestamps: number[];
  playersOnline: Array<number | null>;
};

export function fetchList<T>(endpoint: string, search?: string): Promise<T> {
  const params = new URLSearchParams();
  const trimmed = search?.trim();
  if (trimmed) {
    params.set("search", trimmed);
  }
  const query = params.toString();
  return apiFetch<T>(query ? `${endpoint}?${query}` : endpoint, {
    credentials: "omit",
  });
}
