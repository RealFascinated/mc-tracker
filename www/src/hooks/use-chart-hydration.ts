import { useEffect, useRef, useState } from "react";

import { enqueueChartHydration } from "@/lib/metrics/chart-hydration-queue";

const VIEWPORT_ROOT_MARGIN = "120px 0px";

function useChartHydration() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let cancelled = false;
    let dequeue: (() => void) | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((entry) => entry.isIntersecting);

        if (!intersecting) {
          pendingRef.current = false;
          dequeue?.();
          dequeue = undefined;
          setInView(false);
          return;
        }

        if (pendingRef.current) return;

        pendingRef.current = true;
        dequeue = enqueueChartHydration(() => {
          pendingRef.current = false;
          dequeue = undefined;
          if (!cancelled) setInView(true);
        });
      },
      { rootMargin: VIEWPORT_ROOT_MARGIN },
    );

    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
      dequeue?.();
    };
  }, []);

  return { inView, containerRef };
}

export { useChartHydration };
