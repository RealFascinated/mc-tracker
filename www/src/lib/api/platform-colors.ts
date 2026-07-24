import type { ChartSeriesColor } from "@/lib/metrics/charts/types";

/** Shared Java/Bedrock palette — keep in sync with --platform-java / --platform-bedrock in styles.css */
export const PLATFORM_CHART_COLORS = {
  java: { light: "#1FAD4F", dark: "#63E089" },
  bedrock: { light: "#0B8FD4", dark: "#56CFFF" },
} as const satisfies Record<string, ChartSeriesColor>;
