import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";

type UseIntersectionVisibleOptions = {
  rootMargin?: string;
  threshold?: number;
};

type ItemVisibility = {
  intersecting: boolean;
  hasBeenVisible: boolean;
};

const items = new Map<string, ItemVisibility>();
const subscribers = new Map<string, Set<() => void>>();
const changedKeys = new Set<string>();
let flushScheduled = false;

const DEFAULT_VISIBILITY: ItemVisibility = {
  intersecting: false,
  hasBeenVisible: false,
};

function getSnapshot(key: string): ItemVisibility {
  return items.get(key) ?? DEFAULT_VISIBILITY;
}

function subscribeKey(key: string, callback: () => void) {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(callback);
  const subscriberSet = set;
  return () => {
    subscriberSet.delete(callback);
    if (subscriberSet.size === 0) {
      subscribers.delete(key);
    }
  };
}

function scheduleNotify(key: string) {
  changedKeys.add(key);
  if (flushScheduled) {
    return;
  }
  flushScheduled = true;
  requestAnimationFrame(() => {
    flushScheduled = false;
    for (const changedKey of changedKeys) {
      subscribers.get(changedKey)?.forEach((callback) => callback());
    }
    changedKeys.clear();
  });
}

function updateVisibility(key: string, intersecting: boolean) {
  const prev = getSnapshot(key);
  if (
    prev.intersecting === intersecting &&
    (!intersecting || prev.hasBeenVisible)
  ) {
    return;
  }

  items.set(key, {
    intersecting,
    hasBeenVisible: prev.hasBeenVisible || intersecting,
  });
  scheduleNotify(key);
}

export function useIntersectionVisible({
  rootMargin = "80px 0px",
  threshold = 0,
}: UseIntersectionVisibleOptions = {}) {
  const key = useId();
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element) {
      return;
    }

    if (!items.has(key)) {
      items.set(key, DEFAULT_VISIBILITY);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        updateVisibility(key, entry.isIntersecting);
      },
      { rootMargin, threshold },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      items.delete(key);
      subscribers.delete(key);
    };
  }, [element, key, rootMargin, threshold]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeKey(key, onStoreChange),
    [key],
  );
  const getItemSnapshot = useCallback(() => getSnapshot(key), [key]);
  const { intersecting, hasBeenVisible } = useSyncExternalStore(
    subscribe,
    getItemSnapshot,
    getItemSnapshot,
  );

  return { ref: setElement, isIntersecting: intersecting, hasBeenVisible };
}
