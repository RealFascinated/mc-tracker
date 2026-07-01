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

export type PlayersTimeseriesPayload = {
  from: number;
  to: number;
  step: number;
  timestamps: number[];
  playersOnline: Array<number | null>;
};
