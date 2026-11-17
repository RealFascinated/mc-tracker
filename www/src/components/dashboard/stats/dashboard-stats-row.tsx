import { AnimatedStatValue } from "@/components/dashboard/stats/animated-stat-value";
import { SERVER_PLATFORM_OPTIONS } from "@/lib/api/platform";
import type { PlayersSummaryBase } from "@/lib/api/types";
import { formatPlayers } from "@/lib/formatter";

type DashboardStatsRowProps = {
  summary: PlayersSummaryBase & { trackedServers: number };
};

const PLATFORM_BAR_COLOR: Record<string, string> = {
  PC: "var(--platform-java)",
  PE: "var(--platform-bedrock)",
};

export function DashboardStatsRow({ summary }: DashboardStatsRowProps) {
  const platformFacts = SERVER_PLATFORM_OPTIONS.map((platform) => ({
    label: platform.label,
    value: summary[platform.summaryField] ?? 0,
    color: PLATFORM_BAR_COLOR[platform.value],
  }));

  const facts: Array<{ label: string; value: number | null; color?: string }> =
    [
      { label: "Peak 24h", value: summary.peaks.players24h },
      { label: "Peak 7d", value: summary.peaks.players7d },
      ...platformFacts,
      { label: "Servers tracked", value: summary.trackedServers },
    ];

  return (
    <section className="masthead" aria-label="Network overview">
      <div className="masthead-item">
        <span className="masthead-label">
          <span className="masthead-live status-pulse-dot" aria-hidden />
          Online now
        </span>
        <AnimatedStatValue
          value={summary.totalPlayers}
          className="masthead-value"
          active
        />
      </div>

      {facts.map((fact) => (
        <div key={fact.label} className="masthead-item">
          <span className="masthead-label">
            {fact.color ? (
              <span
                className="masthead-swatch"
                style={{ background: fact.color }}
                aria-hidden
              />
            ) : null}
            {fact.label}
          </span>
          <span className="masthead-value">{formatPlayers(fact.value)}</span>
        </div>
      ))}
    </section>
  );
}
