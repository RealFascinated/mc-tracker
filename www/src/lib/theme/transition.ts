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

  if (!("startViewTransition" in document)) {
    updateDom();
    return;
  }

  const supportsTypedTransitions =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("selector(:active-view-transition-type(theme))");

  if (supportsTypedTransitions) {
    document.startViewTransition({ update: updateDom, types: ["theme"] });
    return;
  }

  document.startViewTransition(updateDom);
}
