import { useEffect, useReducer, useRef } from "react";

import { prefersReducedMotion } from "@/lib/theme/transition";

const DEFAULT_DURATION_MS = 700;

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function normalizeTarget(target: number | null | undefined): number | null {
  if (target == null || Number.isNaN(target)) {
    return null;
  }

  return Math.round(target);
}

type AnimState = {
  from: number;
  to: number;
  start: number;
  countingFromZero: boolean;
};

export function useCountUp(
  target: number | null | undefined,
  durationMs = DEFAULT_DURATION_MS,
  active = true,
): number | null {
  const to = normalizeTarget(target);
  const valueRef = useRef<number | null>(null);
  const animRef = useRef<AnimState | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const [, bumpFrame] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }

    if (to === null) {
      valueRef.current = null;
      animRef.current = null;
      bumpFrame();
      return;
    }

    if (prefersReducedMotion()) {
      valueRef.current = to;
      animRef.current = null;
      bumpFrame();
      return;
    }

    if (!active) {
      animRef.current = null;
      return;
    }

    if (valueRef.current === null) {
      animRef.current = {
        from: 0,
        to,
        start: performance.now(),
        countingFromZero: true,
      };
    } else if (valueRef.current !== to) {
      animRef.current = {
        from: valueRef.current,
        to,
        start: performance.now(),
        countingFromZero: false,
      };
    } else {
      return;
    }

    const anim = animRef.current;

    const tick = (now: number) => {
      const progress = Math.min((now - anim.start) / durationMs, 1);
      const next = Math.round(
        anim.from + (anim.to - anim.from) * easeOutCubic(progress),
      );

      if (progress >= 1) {
        valueRef.current = anim.to;
        animRef.current = null;
        bumpFrame();
        return;
      }

      if (!(anim.countingFromZero && next === 0)) {
        bumpFrame();
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [active, to, durationMs, bumpFrame]);

  if (to === null) {
    return null;
  }

  if (!active && valueRef.current === null) {
    return 0;
  }

  if (!animRef.current) {
    return valueRef.current ?? to;
  }

  const progress = Math.min(
    (performance.now() - animRef.current.start) / durationMs,
    1,
  );
  if (progress >= 1) {
    return animRef.current.to;
  }

  const next = Math.round(
    animRef.current.from +
      (animRef.current.to - animRef.current.from) * easeOutCubic(progress),
  );

  if (animRef.current.countingFromZero && next === 0) {
    return valueRef.current ?? 0;
  }

  return next;
}
