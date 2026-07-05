import { MetricStat } from "@/components/dashboard/stats/metric-stat";
import { staggeredSlideUpDelay } from "@/components/motion/slide-up-animation.constants";
import { SlideUpAnimation } from "@/components/motion/slide-up-animation";
import { SERVER_PLATFORM_OPTIONS } from "@/lib/api/platform";
import type { PlayersSummaryBase } from "@/lib/api/types";

type DashboardStatsRowProps = {
  summary: PlayersSummaryBase & { trackedServers: number };
};

export function DashboardStatsRow({ summary }: DashboardStatsRowProps) {
  const stats: Array<{
    label: string;
    value: number | null;
    highlight?: boolean;
    labelClassName?: string;
  }> = [
    { label: "Online now", value: summary.totalPlayers, highlight: true },
    { label: "Peak 24h", value: summary.peaks.players24h },
    { label: "Peak 7d", value: summary.peaks.players7d },
    ...SERVER_PLATFORM_OPTIONS.map((platform) => ({
      label: platform.label,
      value: summary[platform.summaryField],
      labelClassName: platform.statsLabelClassName,
    })),
    { label: "Tracked servers", value: summary.trackedServers },
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
            labelClassName={stat.labelClassName}
          />
        </SlideUpAnimation>
      ))}
    </div>
  );
}
