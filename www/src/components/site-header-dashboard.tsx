import type { ReactNode } from "react";

import { DashboardTimeControls } from "@/components/dashboard/dashboard-time-controls";
import { SiteHeaderPageNav } from "@/components/site-header-page-nav";
import {
  SiteHeaderNav,
  SiteHeaderToolbar,
} from "@/components/site-header-toolbar";
import type { MetricTimeRange } from "@/lib/metrics/range";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type SiteHeaderDashboardProps = {
  window: MetricTimeWindow;
  onPresetChange: (range: MetricTimeRange) => void;
  onCustomChange: (from: number, to: number) => void;
  search?: ReactNode;
};

function SiteHeaderDashboard({
  window,
  onPresetChange,
  onCustomChange,
  search,
}: SiteHeaderDashboardProps) {
  return (
    <>
      <SiteHeaderNav>
        <div className="site-header-controls">
          <SiteHeaderPageNav />
          <DashboardTimeControls
            window={window}
            onPresetChange={onPresetChange}
            onCustomChange={onCustomChange}
          />
        </div>
      </SiteHeaderNav>
      <SiteHeaderToolbar>
        <div className="dashboard-header-search-slot">{search}</div>
      </SiteHeaderToolbar>
    </>
  );
}

export { SiteHeaderDashboard };
