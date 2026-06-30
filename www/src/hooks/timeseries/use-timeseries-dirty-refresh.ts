import { useEffect, useRef } from "react";

import { TIMESERIES_REFETCH_MS } from "@/lib/api/timeseries-refresh";

export function useTimeseriesDirtyRefresh({
  isVisible,
  dataUpdatedAt,
  refetch,
}: {
  isVisible: boolean;
  dataUpdatedAt: number;
  refetch: () => Promise<unknown>;
}) {
  const dirtyRef = useRef(false);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (isVisible || dataUpdatedAt === 0) {
      return;
    }

    const markDirtyIfStale = () => {
      if (Date.now() - dataUpdatedAt >= TIMESERIES_REFETCH_MS) {
        dirtyRef.current = true;
      }
    };

    markDirtyIfStale();
    const intervalId = window.setInterval(
      markDirtyIfStale,
      TIMESERIES_REFETCH_MS,
    );
    return () => window.clearInterval(intervalId);
  }, [isVisible, dataUpdatedAt]);

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
