import type { ChartSeriesColor } from "@/lib/metrics/charts/types";
import type { ResolvedTheme } from "@/lib/theme/context";
import { readCssVar } from "@/lib/css-vars";

const CHART_COLOR_VARS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
] as const;

const CHART_PALETTE_LIGHT = [
  "#7A6FDB",
  "#4A84E6",
  "#3AADBE",
  "#3FAF87",
  "#D4A030",
  "#DC6B6B",
] as const;

const CHART_PALETTE_DARK = [
  "#38bdf8",
  "#a78bfa",
  "#22D3EE",
  "#34D399",
  "#FBBF24",
  "#F87171",
] as const;

function fallbackPalette(theme: ResolvedTheme): ReadonlyArray<string> {
  return theme === "dark" ? CHART_PALETTE_DARK : CHART_PALETTE_LIGHT;
}

export function getChartColors(theme: ResolvedTheme = "light"): Array<string> {
  const fallbacks = fallbackPalette(theme);
  return CHART_COLOR_VARS.map((cssVar, index) =>
    readCssVar(cssVar, fallbacks[index]),
  );
}

function getChartColor(
  index: number,
  theme: ResolvedTheme = "light",
): string {
  const palette = getChartColors(theme);
  return palette[index % palette.length];
}

export function resolveChartSeriesColor(
  color: ChartSeriesColor | undefined,
  index: number,
  theme: ResolvedTheme = "light",
): string {
  if (color) return theme === "dark" ? color.dark : color.light;
  return getChartColor(index, theme);
}
