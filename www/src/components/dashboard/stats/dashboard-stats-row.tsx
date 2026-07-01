import { MetricStat } from "@/components/dashboard/stats/metric-stat";
import { staggeredSlideUpDelay } from "@/components/motion/slide-up-animation.constants";
import { SlideUpAnimation } from "@/components/motion/slide-up-animation";
import type { PlayersSummaryBase } from "@/lib/api/types";

type DashboardStatsRowProps = {
  summary: PlayersSummaryBase;
};

export function DashboardStatsRow({ summary }: DashboardStatsRowProps) {
  const stats: Array<{
    label: string;
    value: number | null;
    highlight?: boolean;
  }> = [
    { label: "Online now", value: summary.totalPlayers, highlight: true },
    { label: "Peak 24h", value: summary.peaks.players24h },
    { label: "Peak 7d", value: summary.peaks.players7d },
    { label: "Java", value: summary.playersPc },
    { label: "Bedrock", value: summary.playersPe },
  ];

  return (
    <div className="dashboard-stats-row">
      {stats.map((stat, index) => (
        <SlideUpAnimation
          key={stat.label}
          delay={staggeredSlideUpDelay(index)}
          className="min-w-0"
        >
          <MetricStat
            label={stat.label}
            value={stat.value}
            highlight={stat.highlight}
          />
        </SlideUpAnimation>
      ))}
    </div>
  );
}
