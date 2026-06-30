import {
  DEFAULT_DASHBOARD_REFRESH_INTERVAL,
  dashboardRefreshIntervalToMs,
} from "@/lib/dashboard/refresh-interval";

/** Default timeseries poll interval when dashboard refresh context is unavailable. */
export const TIMESERIES_REFETCH_MS = dashboardRefreshIntervalToMs(
  DEFAULT_DASHBOARD_REFRESH_INTERVAL,
) as number;
