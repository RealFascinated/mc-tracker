export const DASHBOARD_REFRESH_STORAGE_KEY = "mc-tracker-refresh-interval";

export type DashboardRefreshInterval = "10s" | "30s" | "1m" | "5m" | "off";

export type DashboardRefreshIntervalOption = {
  value: DashboardRefreshInterval;
  label: string;
  shortLabel: string;
  ms: number | false;
};

export const DEFAULT_DASHBOARD_REFRESH_INTERVAL: DashboardRefreshInterval =
  "30s";

export const DASHBOARD_REFRESH_INTERVAL_OPTIONS: Array<DashboardRefreshIntervalOption> =
  [
    { value: "10s", label: "Every 10 seconds", shortLabel: "10s", ms: 10_000 },
    { value: "30s", label: "Every 30 seconds", shortLabel: "30s", ms: 30_000 },
    { value: "1m", label: "Every minute", shortLabel: "1m", ms: 60_000 },
    { value: "5m", label: "Every 5 minutes", shortLabel: "5m", ms: 300_000 },
    { value: "off", label: "Off", shortLabel: "Off", ms: false },
  ];

const INTERVAL_BY_VALUE = Object.fromEntries(
  DASHBOARD_REFRESH_INTERVAL_OPTIONS.map((option) => [option.value, option]),
) as Record<DashboardRefreshInterval, DashboardRefreshIntervalOption>;

export function getDashboardRefreshIntervalOption(
  value: DashboardRefreshInterval,
): DashboardRefreshIntervalOption {
  return INTERVAL_BY_VALUE[value];
}

export function dashboardRefreshIntervalToMs(
  value: DashboardRefreshInterval,
): number | false {
  return getDashboardRefreshIntervalOption(value).ms;
}

export function isDashboardRefreshInterval(
  value: string,
): value is DashboardRefreshInterval {
  return DASHBOARD_REFRESH_INTERVAL_OPTIONS.some(
    (option) => option.value === value,
  );
}
