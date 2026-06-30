function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function startThemeViewTransition(updateDom: () => void): void {
  if (prefersReducedMotion() || !("startViewTransition" in document)) {
    updateDom();
    return;
  }

  document.startViewTransition(updateDom);
}
