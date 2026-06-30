import { useEffect, useRef, useState } from "react";

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

/**
 * When `visible` is passed, defers to that signal (e.g. parent IntersectionObserver)
 * instead of attaching a second observer on the chart container.
 */
function useChartHydration(visible?: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const usesExternalVisible = visible !== undefined;

  useEffect(() => {
    if (!usesExternalVisible) return;

    if (!visible) {
      setInView(false);
      return;
    }

    const { cancel } = scheduleHydration(() => setInView(true));
    return cancel;
  }, [usesExternalVisible, visible]);

  useEffect(() => {
    if (usesExternalVisible) return;

    const element = containerRef.current;
    if (!element) return;

    let cancelled = false;
    let hydration: { cancel: () => void } | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((entry) => entry.isIntersecting);

        if (!intersecting) {
          hydration?.cancel();
          hydration = undefined;
          setInView(false);
          return;
        }

        if (hydration) return;

        hydration = scheduleHydration(() => {
          hydration = undefined;
          if (!cancelled) setInView(true);
        });
      },
      { rootMargin: VIEWPORT_ROOT_MARGIN },
    );

    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
      hydration?.cancel();
    };
  }, [usesExternalVisible]);

  return { inView, containerRef };
}

export { useChartHydration };
