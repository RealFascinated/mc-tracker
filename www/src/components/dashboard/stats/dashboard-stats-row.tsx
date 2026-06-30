import { MetricStat } from "@/components/dashboard/stats/metric-stat";
import { PeakAllTimeStat } from "@/components/dashboard/stats/peak-all-time-stat";
import { formatPlayers } from "@/lib/format-players";
import type { PlayersSummaryBase } from "@/lib/api/types";

type DashboardStatsRowProps = {
  summary: PlayersSummaryBase;
};

export function DashboardStatsRow({ summary }: DashboardStatsRowProps) {
  return (
    <div className="dashboard-stats-row">
      <MetricStat
        label="Online now"
        value={formatPlayers(summary.totalPlayers)}
        highlight
      />
      <MetricStat
        label="Peak 24h"
        value={formatPlayers(summary.peakPlayers24h)}
      />
      <PeakAllTimeStat peak={summary.peakPlayersAllTime} />
      <MetricStat label="Java" value={formatPlayers(summary.playersPc)} />
      <MetricStat label="Bedrock" value={formatPlayers(summary.playersPe)} />
    </div>
  );
}
