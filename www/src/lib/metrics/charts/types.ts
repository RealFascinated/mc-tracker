import type { ChartAxisFormat } from "@/lib/metrics/chart-axis-format";
import type { ChartYRange } from "@/lib/metrics/uplot-theme";

export type UnitKind =
  "bps" | "bytes" | "mbps" | "ms" | "percent" | "celsius" | "count";

export type YRangeSpec =
  | "auto"
  | "autoMin"
  | { softMax: number }
  | { min: number; max: number };

export type AxisDefinition = {
  unit: UnitKind;
  side?: "left" | "right";
  yRange?: YRangeSpec;
  visible?: boolean;
};

export type ChartSeriesColor = {
  light: string;
  dark: string;
};

export type ChartSeriesDefinition = {
  key: string;
  label: string;
  unit: UnitKind;
  axis: string;
  render?: "line" | "bar";
  valueFormatter?: (value: number) => string;
  color?: ChartSeriesColor;
  fill?: boolean;
};

export type ChartDefinition = {
  id: string;
  title: string;
  series: Array<ChartSeriesDefinition>;
  axes: Record<string, AxisDefinition>;
};

export type AxisRenderConfig = {
  id: string;
  format: ChartAxisFormat;
  yRange: ChartYRange;
  side: "left" | "right";
  visible: boolean;
};

export type TooltipSortEntry = {
  value: number;
  label: string;
  seriesIndex: number;
};
