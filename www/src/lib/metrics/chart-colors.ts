import type { ChartSeriesColor } from "@/lib/metrics/charts/types";
import type { ResolvedTheme } from "@/lib/theme/theme-context";
import { readCssVar } from "@/lib/css-vars";

const CHART_COLOR_VARS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
] as const;

export function getChartColors(): Array<string> {
  return CHART_COLOR_VARS.map((cssVar) => readCssVar(cssVar));
}

function getChartColor(index: number): string {
  const palette = getChartColors();
  return palette[index % palette.length];
}

export function resolveChartSeriesColor(
  color: ChartSeriesColor | undefined,
  index: number,
  theme: ResolvedTheme = "light",
): string {
  if (color) return theme === "dark" ? color.dark : color.light;
  return getChartColor(index);
}
