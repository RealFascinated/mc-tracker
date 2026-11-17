import type { ChartSeriesColor } from "@/lib/metrics/charts/types";

/** Shared Java/Bedrock palette — keep in sync with --platform-java / --platform-bedrock in styles.css */
export const PLATFORM_CHART_COLORS = {
  java: { light: "#2D7A4D", dark: "#8FC49B" },
  bedrock: { light: "#2F6A99", dark: "#7FB0DC" },
} as const satisfies Record<string, ChartSeriesColor>;
