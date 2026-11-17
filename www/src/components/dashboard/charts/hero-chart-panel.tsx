import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TotalPlayersChart } from "@/components/dashboard/charts/total-players-chart";
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
    <>
      <section className="hero-chart-panel" aria-label="Player history">
        <div className="hero-chart-head">
          <h2 className="section-label">Player history</h2>
          <div className="flex items-center gap-3">
            <Label
              htmlFor="global-chart-annotations"
              className="text-xs font-normal text-muted-foreground"
            >
              Annotations
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
        </div>
        <TotalPlayersChart
          hasServers={hasServers}
          window={window}
          height={320}
          showAnnotations={showAnnotations}
          mode={mode}
        />
      </section>
    </>
  );
}
