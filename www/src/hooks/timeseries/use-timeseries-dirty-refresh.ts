import { useEffect, useRef } from "react";

import { useDashboardRefreshIntervalMs } from "@/lib/dashboard/refresh-context";

export function useTimeseriesDirtyRefresh({
  isVisible,
  dataUpdatedAt,
  refetch,
}: {
  isVisible: boolean;
  dataUpdatedAt: number;
  refetch: () => Promise<unknown>;
}) {
  const refreshIntervalMs = useDashboardRefreshIntervalMs();
  const dirtyRef = useRef(false);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (isVisible || dataUpdatedAt === 0 || refreshIntervalMs === false) {
      return;
    }

    const markDirtyIfStale = () => {
      if (Date.now() - dataUpdatedAt >= refreshIntervalMs) {
        dirtyRef.current = true;
      }
    };

    markDirtyIfStale();
    const intervalId = window.setInterval(markDirtyIfStale, refreshIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [isVisible, dataUpdatedAt, refreshIntervalMs]);

  useEffect(() => {
    if (isVisible) {
      return;
    }

    const onFocus = () => {
      if (dataUpdatedAt > 0) {
        dirtyRef.current = true;
      }
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isVisible, dataUpdatedAt]);

  useEffect(() => {
    if (!isVisible || !dirtyRef.current) {
      return;
    }

    dirtyRef.current = false;
    void refetchRef.current();
  }, [isVisible]);
}
