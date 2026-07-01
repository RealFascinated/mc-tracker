import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";

import { enqueueChartHydration } from "@/lib/metrics/chart-hydration-queue";

const VIEWPORT_ROOT_MARGIN = "120px 0px";

function scheduleHydration(onHydrated: () => void): { cancel: () => void } {
  let cancelled = false;
  const dequeue = enqueueChartHydration(() => {
    if (!cancelled) onHydrated();
  });

  return {
    cancel: () => {
      cancelled = true;
      dequeue();
    },
  };
}

const intersectingByKey = new Map<string, boolean>();
const hydratedByKey = new Map<string, boolean>();
const storeSubscribers = new Map<string, Set<() => void>>();
const storeChangedKeys = new Set<string>();
let storeFlushScheduled = false;

function getIntersectingSnapshot(key: string): boolean {
  return intersectingByKey.get(key) ?? false;
}

function getHydratedSnapshot(key: string): boolean {
  return hydratedByKey.get(key) ?? false;
}

function subscribeStore(key: string, callback: () => void) {
  let set = storeSubscribers.get(key);
  if (!set) {
    set = new Set();
    storeSubscribers.set(key, set);
  }
  set.add(callback);
  const subscriberSet = set;
  return () => {
    subscriberSet.delete(callback);
    if (subscriberSet.size === 0) {
      storeSubscribers.delete(key);
    }
  };
}

function scheduleStoreNotify(key: string) {
  storeChangedKeys.add(key);
  if (storeFlushScheduled) {
    return;
  }
  storeFlushScheduled = true;
  requestAnimationFrame(() => {
    storeFlushScheduled = false;
    for (const changedKey of storeChangedKeys) {
      storeSubscribers.get(changedKey)?.forEach((callback) => callback());
    }
    storeChangedKeys.clear();
  });
}

function setIntersecting(key: string, intersecting: boolean) {
  if (getIntersectingSnapshot(key) === intersecting) {
    return;
  }
  intersectingByKey.set(key, intersecting);
  scheduleStoreNotify(key);
}

function setHydrated(key: string, hydrated: boolean) {
  if (getHydratedSnapshot(key) === hydrated) {
    return;
  }
  hydratedByKey.set(key, hydrated);
  scheduleStoreNotify(key);
}

/**
 * When `visible` is passed, defers to that signal (e.g. parent IntersectionObserver)
 * instead of attaching a second observer on the chart container.
 */
function useChartHydration(visible?: boolean) {
  const intersectionKey = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const usesExternalVisible = visible !== undefined;

  const subscribeIntersectingStore = useCallback(
    (onStoreChange: () => void) =>
      subscribeStore(intersectionKey, onStoreChange),
    [intersectionKey],
  );
  const getIntersectingStoreSnapshot = useCallback(
    () => getIntersectingSnapshot(intersectionKey),
    [intersectionKey],
  );
  const getHydratedStoreSnapshot = useCallback(
    () => getHydratedSnapshot(intersectionKey),
    [intersectionKey],
  );

  const intersecting = useSyncExternalStore(
    subscribeIntersectingStore,
    getIntersectingStoreSnapshot,
    getIntersectingStoreSnapshot,
  );
  const hydrated = useSyncExternalStore(
    subscribeIntersectingStore,
    getHydratedStoreSnapshot,
    getHydratedStoreSnapshot,
  );

  const inView = usesExternalVisible
    ? Boolean(visible)
    : intersecting && hydrated;

  useEffect(() => {
    if (usesExternalVisible) return;

    const element = containerRef.current;
    if (!element) return;

    let cancelled = false;
    let hydration: { cancel: () => void } | undefined;

    if (!intersectingByKey.has(intersectionKey)) {
      intersectingByKey.set(intersectionKey, false);
    }
    if (!hydratedByKey.has(intersectionKey)) {
      hydratedByKey.set(intersectionKey, false);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries.some((entry) => entry.isIntersecting);
        setIntersecting(intersectionKey, isIntersecting);

        if (!isIntersecting) {
          hydration?.cancel();
          hydration = undefined;
          return;
        }

        if (hydration || getHydratedSnapshot(intersectionKey)) return;

        hydration = scheduleHydration(() => {
          hydration = undefined;
          if (!cancelled) {
            setHydrated(intersectionKey, true);
          }
        });
      },
      { rootMargin: VIEWPORT_ROOT_MARGIN },
    );

    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
      hydration?.cancel();
      intersectingByKey.delete(intersectionKey);
      hydratedByKey.delete(intersectionKey);
      storeSubscribers.delete(intersectionKey);
    };
  }, [usesExternalVisible, intersectionKey]);

  return { inView, containerRef };
}

export { useChartHydration };
