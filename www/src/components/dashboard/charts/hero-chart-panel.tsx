import { useState } from "react";

import { DashboardCard } from "@/components/dashboard/cards/card";
import { DashboardCardHeader } from "@/components/dashboard/cards/card-header";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TotalPlayersChart } from "@/components/dashboard/charts/total-players-chart";
import { FadeInAnimation } from "@/components/motion/fade-in-animation";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { SegmentedControl } from "@/components/ui/segmented-control";

type HeroChartPanelProps = {
  hasServers: boolean;
  window: MetricTimeWindow;
};

export function HeroChartPanel({ hasServers, window }: HeroChartPanelProps) {
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [mode, setMode] = useState<"overall" | "servers">("overall");

  return (
    <FadeInAnimation>
      <DashboardCard className="hero-chart-panel">
        <DashboardCardHeader
          title="Total players"
          trailingAction={
            <div className="flex items-center gap-2">
              <Label
                htmlFor="global-chart-annotations"
                className="text-xs font-normal text-muted-foreground"
              >
                Show annotations
              </Label>
              <Switch
                id="global-chart-annotations"
                size="sm"
                checked={showAnnotations}
                onCheckedChange={setShowAnnotations}
                aria-label="Show annotations"
              />
              <SegmentedControl
                value={mode}
                options={[
                  { value: "overall", shortLabel: "Overall" },
                  { value: "servers", shortLabel: "Servers" },
                ]}
                onValueChange={setMode}
                aria-label="Chart mode"
              />
            </div>
          }
        />
        <TotalPlayersChart
          hasServers={hasServers}
          window={window}
          height={360}
          showAnnotations={showAnnotations}
          mode={mode}
        />
      </DashboardCard>
    </FadeInAnimation>
  );
}
