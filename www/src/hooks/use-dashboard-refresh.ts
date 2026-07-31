import { use } from "react";

import {
  DashboardRefreshContext,
  DashboardRefreshEpochContext,
} from "@/lib/dashboard/dashboard-refresh-context";
import type { DashboardRefreshContextValue } from "@/lib/dashboard/dashboard-refresh-context";
import {
  DEFAULT_DASHBOARD_REFRESH_INTERVAL,
  dashboardRefreshIntervalToMs,
} from "@/lib/dashboard/refresh-interval";

function useDashboardRefresh(): DashboardRefreshContextValue {
  const context = use(DashboardRefreshContext);
  if (!context) {
    throw new Error(
      "useDashboardRefresh must be used within DashboardRefreshProvider",
    );
  }
  return context;
}

function useDashboardRefreshIntervalMs(): number | false {
  const context = use(DashboardRefreshContext);
  return (
    context?.refreshIntervalMs ??
    dashboardRefreshIntervalToMs(DEFAULT_DASHBOARD_REFRESH_INTERVAL)
  );
}

function useDashboardRefreshEpoch(): number {
  const epochAnchor = use(DashboardRefreshEpochContext);
  if (epochAnchor == null) {
    throw new Error(
      "useDashboardRefreshEpoch must be used within DashboardRefreshProvider",
    );
  }
  return epochAnchor;
}

export {
  useDashboardRefresh,
  useDashboardRefreshEpoch,
  useDashboardRefreshIntervalMs,
};
