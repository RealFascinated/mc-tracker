import { createContext } from "react";

import type { DashboardRefreshInterval } from "@/lib/dashboard/refresh-interval";

export type DashboardRefreshContextValue = {
  refreshInterval: DashboardRefreshInterval;
  refreshIntervalMs: number | false;
  setRefreshInterval: (interval: DashboardRefreshInterval) => void;
  refreshAll: () => Promise<void>;
  isRefreshing: boolean;
  /** Rolling "now" for preset time windows; bumps on manual and auto refresh. */
  epochAnchor: number;
};

export const DashboardRefreshContext =
  createContext<DashboardRefreshContextValue | null>(null);
