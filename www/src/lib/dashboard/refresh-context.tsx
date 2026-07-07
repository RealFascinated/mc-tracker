import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  localStorageStringOptions,
  useLocalStorage,
} from "@/hooks/use-local-storage";
import {
  asnsQueryKey,
  asnsTimeseriesQueryKey,
  asnQueryKey,
} from "@/lib/api/asns.queries";
import {
  serversQueryKey,
  serverQueryKey,
  serversTimeseriesQueryKey,
} from "@/lib/api/servers.queries";
import { pinnedServersQueryKey } from "@/lib/api/pinned-servers.queries";
import { DashboardRefreshContext } from "@/lib/dashboard/dashboard-refresh-context";
import {
  DASHBOARD_REFRESH_STORAGE_KEY,
  DEFAULT_DASHBOARD_REFRESH_INTERVAL,
  dashboardRefreshIntervalToMs,
  isDashboardRefreshInterval,
} from "@/lib/dashboard/refresh-interval";

function DashboardRefreshProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [refreshInterval, setRefreshInterval] = useLocalStorage(
    DASHBOARD_REFRESH_STORAGE_KEY,
    {
      defaultValue: DEFAULT_DASHBOARD_REFRESH_INTERVAL,
      ...localStorageStringOptions,
      deserialize: (raw) => (isDashboardRefreshInterval(raw) ? raw : null),
    },
  );
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [epochAnchor, setEpochAnchor] = useState(() =>
    Math.floor(Date.now() / 1000),
  );

  const refreshIntervalMs = dashboardRefreshIntervalToMs(refreshInterval);

  const bumpEpochAnchor = useCallback(() => {
    setEpochAnchor(Math.floor(Date.now() / 1000));
  }, []);

  useEffect(() => {
    if (refreshIntervalMs === false) {
      return;
    }

    const intervalId = window.setInterval(bumpEpochAnchor, refreshIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [refreshIntervalMs, bumpEpochAnchor]);

  const refreshAll = useCallback(async () => {
    bumpEpochAnchor();
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: serversQueryKey }),
        queryClient.invalidateQueries({ queryKey: serverQueryKey }),
        queryClient.invalidateQueries({ queryKey: asnsQueryKey }),
        queryClient.invalidateQueries({ queryKey: asnQueryKey }),
        queryClient.invalidateQueries({ queryKey: serversTimeseriesQueryKey }),
        queryClient.invalidateQueries({ queryKey: asnsTimeseriesQueryKey }),
        queryClient.invalidateQueries({ queryKey: pinnedServersQueryKey }),
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
  }, [bumpEpochAnchor, queryClient]);

  const isQueryRefreshing =
    useIsFetching({
      predicate: (query) => {
        const key = query.queryKey[0];
        return key === "servers" || key === "asns" || key === "pinned-servers";
      },
    }) > 0;

  const value = useMemo(
    () => ({
      refreshInterval,
      refreshIntervalMs,
      setRefreshInterval,
      refreshAll,
      isRefreshing: isManualRefreshing || isQueryRefreshing,
      epochAnchor,
    }),
    [
      epochAnchor,
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

export { DashboardRefreshProvider };
