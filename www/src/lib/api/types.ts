import { apiFetch } from "@/lib/api/client";

export type PeakPlayers = {
  players: number;
  at: number;
};

export type PlayersSummaryBase = {
  totalPlayers: number;
  playersPc: number;
  playersPe: number;
  peakPlayers24h: number | null;
  peakPlayersAllTime: PeakPlayers | null;
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
