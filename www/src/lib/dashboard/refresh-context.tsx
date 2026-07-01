import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { asnsQueryKey, asnsTimeseriesQueryKey, asnQueryKey } from "@/lib/api/asns.queries";
import {
  serversQueryKey,
  serverQueryKey,
  serversTimeseriesQueryKey,
} from "@/lib/api/servers.queries";
import {
  DASHBOARD_REFRESH_STORAGE_KEY,
  DEFAULT_DASHBOARD_REFRESH_INTERVAL,
  dashboardRefreshIntervalToMs,
  getStoredDashboardRefreshInterval,
} from "@/lib/dashboard/refresh-interval";
import type { DashboardRefreshInterval } from "@/lib/dashboard/refresh-interval";

type DashboardRefreshContextValue = {
  refreshInterval: DashboardRefreshInterval;
  refreshIntervalMs: number | false;
  setRefreshInterval: (interval: DashboardRefreshInterval) => void;
  refreshAll: () => Promise<void>;
  isRefreshing: boolean;
};

const DashboardRefreshContext =
  createContext<DashboardRefreshContextValue | null>(null);

function DashboardRefreshProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [refreshInterval, setRefreshIntervalState] =
    useState<DashboardRefreshInterval>(
      () =>
        getStoredDashboardRefreshInterval() ??
        DEFAULT_DASHBOARD_REFRESH_INTERVAL,
    );
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const refreshIntervalMs = dashboardRefreshIntervalToMs(refreshInterval);

  const setRefreshInterval = useCallback(
    (nextInterval: DashboardRefreshInterval) => {
      localStorage.setItem(DASHBOARD_REFRESH_STORAGE_KEY, nextInterval);
      setRefreshIntervalState(nextInterval);
    },
    [],
  );

  const refreshAll = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: serversQueryKey }),
        queryClient.invalidateQueries({ queryKey: serverQueryKey }),
        queryClient.invalidateQueries({ queryKey: asnsQueryKey }),
        queryClient.invalidateQueries({ queryKey: asnQueryKey }),
        queryClient.invalidateQueries({ queryKey: serversTimeseriesQueryKey }),
        queryClient.invalidateQueries({ queryKey: asnsTimeseriesQueryKey }),
        queryClient.refetchQueries({
          queryKey: serversTimeseriesQueryKey,
          type: "active",
        }),
        queryClient.refetchQueries({
          queryKey: asnsTimeseriesQueryKey,
          type: "active",
        }),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [queryClient]);

  const isQueryRefreshing =
    useIsFetching({
      predicate: (query) => {
        const key = query.queryKey[0];
        return key === "servers" || key === "asns";
      },
    }) > 0;

  const value = useMemo(
    () => ({
      refreshInterval,
      refreshIntervalMs,
      setRefreshInterval,
      refreshAll,
      isRefreshing: isManualRefreshing || isQueryRefreshing,
    }),
    [
      isManualRefreshing,
      isQueryRefreshing,
      refreshAll,
      refreshInterval,
      refreshIntervalMs,
      setRefreshInterval,
    ],
  );

  return (
    <DashboardRefreshContext.Provider value={value}>
      {children}
    </DashboardRefreshContext.Provider>
  );
}

function useDashboardRefresh(): DashboardRefreshContextValue {
  const context = useContext(DashboardRefreshContext);
  if (!context) {
    throw new Error(
      "useDashboardRefresh must be used within DashboardRefreshProvider",
    );
  }
  return context;
}

function useDashboardRefreshIntervalMs(): number | false {
  const context = useContext(DashboardRefreshContext);
  return (
    context?.refreshIntervalMs ??
    dashboardRefreshIntervalToMs(DEFAULT_DASHBOARD_REFRESH_INTERVAL)
  );
}

export {
  DashboardRefreshProvider,
  useDashboardRefresh,
  useDashboardRefreshIntervalMs,
};
