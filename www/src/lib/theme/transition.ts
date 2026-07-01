import { startTransition } from "react";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function startThemeViewTransition(updateDom: () => void): void {
  if (prefersReducedMotion()) {
    updateDom();
    return;
  }

  startTransition(updateDom);
}
