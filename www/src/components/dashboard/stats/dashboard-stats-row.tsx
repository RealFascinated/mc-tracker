import { MetricStat } from "@/components/dashboard/stats/metric-stat";
import { formatPlayers } from "@/lib/format-players";
import { peakTimestampTooltip } from "@/lib/format-peak-at";
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
        value={formatPlayers(summary.peaks.players24h)}
      />
      <MetricStat
        label="Peak 7d"
        value={formatPlayers(summary.peaks.players7d)}
      />
      <MetricStat
        label="All-time"
        value={formatPlayers(summary.peaks.allTime?.players ?? null)}
        valueTooltip={peakTimestampTooltip(summary.peaks.allTime?.timestamp)}
      />
      <MetricStat label="Java" value={formatPlayers(summary.playersPc)} />
      <MetricStat label="Bedrock" value={formatPlayers(summary.playersPe)} />
    </div>
  );
}
