import type { UnitKind } from "@/lib/metrics/charts/types";
import type { ChartAxisFormat } from "@/lib/metrics/chart-axis-format";
import {
  bytesAxisFormat,
  celsiusAxisFormat,
  countAxisFormat,
  mbpsAxisFormat,
  millisecondsAxisFormat,
  networkBpsAxisFormat,
  percentAxisFormat,
} from "@/lib/metrics/chart-axis-format";

const UNIT_FORMATTERS: Record<UnitKind, ChartAxisFormat> = {
  bps: networkBpsAxisFormat,
  bytes: bytesAxisFormat,
  mbps: mbpsAxisFormat,
  ms: millisecondsAxisFormat,
  percent: percentAxisFormat,
  celsius: celsiusAxisFormat,
  count: countAxisFormat,
};

export function unitFormatter(unit: UnitKind): ChartAxisFormat {
  return UNIT_FORMATTERS[unit];
}
