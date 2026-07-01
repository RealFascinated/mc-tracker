import type { ThemeTransitionOrigin } from "@/lib/theme/theme-context";

const THEME_TRANSITION_MS = 580;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resolveOrigin(origin?: ThemeTransitionOrigin): ThemeTransitionOrigin {
  return (
    origin ?? {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }
  );
}

function getRevealRadius(origin: ThemeTransitionOrigin): number {
  const { x, y } = origin;
  return Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
}

function setTransitionOrigin(origin: ThemeTransitionOrigin, endRadius: number) {
  const root = document.documentElement;
  root.style.setProperty("--theme-transition-x", `${origin.x}px`);
  root.style.setProperty("--theme-transition-y", `${origin.y}px`);
  root.style.setProperty("--theme-transition-r", `${endRadius}px`);
}

function clearTransitionOrigin() {
  const root = document.documentElement;
  root.style.removeProperty("--theme-transition-x");
  root.style.removeProperty("--theme-transition-y");
  root.style.removeProperty("--theme-transition-r");
}

function getThemeTransitionEasing(): string {
  const easing = getComputedStyle(document.documentElement)
    .getPropertyValue("--expo-out")
    .trim();
  return easing || "ease-out";
}

function animateThemeReveal(endRadius: number): void {
  const maskEnd = endRadius * 2.4;
  const easing = getThemeTransitionEasing();

  document.documentElement.animate(
    { maskSize: ["0px 0px", `${maskEnd}px ${maskEnd}px`] },
    {
      duration: THEME_TRANSITION_MS,
      easing,
      pseudoElement: "::view-transition-new(root)",
      fill: "both",
    },
  );
}

export function startThemeViewTransition(
  updateDom: () => void,
  origin?: ThemeTransitionOrigin,
): void {
  if (prefersReducedMotion()) {
    updateDom();
    return;
  }

  if (!("startViewTransition" in document)) {
    updateDom();
    return;
  }

  const resolvedOrigin = resolveOrigin(origin);
  const endRadius = getRevealRadius(resolvedOrigin);
  setTransitionOrigin(resolvedOrigin, endRadius);

  const transition = document.startViewTransition(updateDom);

  void transition.ready
    .then(() => {
      animateThemeReveal(endRadius);
    })
    .catch(() => {
      // Transition was skipped; DOM update still applied.
    });

  void transition.finished.finally(clearTransitionOrigin);
}
