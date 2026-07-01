export function readCssVar(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }

  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
