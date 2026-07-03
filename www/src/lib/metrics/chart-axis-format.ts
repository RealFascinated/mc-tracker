import {
  formatCelsius,
  formatDecimal,
  formatNetworkBps,
  formatPercentValue,
  formatPlayers,
  formatPlayersAxisTick,
} from "@/lib/formatter";

export type ChartAxisFormat = {
  formatValue: (value: number) => string;
  formatAxisTick: (value: number, rangeMax: number) => string;
  axisUnitLabel: (rangeMax: number) => string;
};

/** Compact, grouping-free labels for axis ticks to avoid gutter overflow. */
const axisTickCompactFormatter0 = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 0,
});

const axisTickCompactFormatter1 = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

const axisTickIntegerFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  useGrouping: false,
});

const axisTickDecimalFormatters = new Map<number, Intl.NumberFormat>([
  [
    1,
    new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
      useGrouping: false,
    }),
  ],
  [
    2,
    new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      useGrouping: false,
    }),
  ],
]);

function formatAxisTickNumber(value: number, fractionDigits = 0): string {
  const abs = Math.abs(value);
  if (abs >= 10_000) {
    return (
      abs >= 100_000 ? axisTickCompactFormatter0 : axisTickCompactFormatter1
    ).format(value);
  }
  if (fractionDigits === 0) {
    return axisTickIntegerFormatter.format(value);
  }
  return (
    axisTickDecimalFormatters.get(fractionDigits) ?? axisTickIntegerFormatter
  ).format(value);
}

function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let scaled = Math.max(value, 0);
  let unitIndex = 0;

  while (scaled >= 1024 && unitIndex < units.length - 1) {
    scaled /= 1024;
    unitIndex += 1;
  }

  const fractionDigits =
    scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2;
  return `${formatDecimal(scaled, fractionDigits)} ${units[unitIndex]}`;
}

function formatSpeedMbps(value: number): string {
  return value >= 10
    ? `${formatDecimal(value, 0)} Mbps`
    : `${formatDecimal(value, 1)} Mbps`;
}

function formatSpeedtestLatency(value: number): string {
  return `${formatDecimal(value, 0)} ms`;
}

function createScaledAxisFormat({
  units,
  base,
  formatValue,
  fractionDigits,
}: {
  units: ReadonlyArray<string>;
  base: 1000 | 1024;
  formatValue: (value: number) => string;
  fractionDigits: (scaled: number, unitIndex: number) => number;
}): ChartAxisFormat {
  function scaleForRange(rangeMax: number) {
    let probe = Math.max(rangeMax, 0);
    let unitIndex = 0;
    while (probe >= base && unitIndex < units.length - 1) {
      probe /= base;
      unitIndex += 1;
    }
    const divisor = base ** unitIndex;
    return { divisor, unitIndex };
  }

  return {
    formatValue,
    formatAxisTick: (value, rangeMax) => {
      const { divisor, unitIndex } = scaleForRange(rangeMax);
      const scaled = value / divisor;
      return formatAxisTickNumber(scaled, fractionDigits(scaled, unitIndex));
    },
    axisUnitLabel: (rangeMax) => {
      const { unitIndex } = scaleForRange(rangeMax);
      return units[unitIndex] ?? "";
    },
  };
}

export const networkBpsAxisFormat = createScaledAxisFormat({
  units: ["bps", "Kbps", "Mbps", "Gbps"],
  base: 1000,
  formatValue: formatNetworkBps,
  fractionDigits: (scaled, unitIndex) =>
    scaled >= 10 || unitIndex === 0 ? 0 : 1,
});

export const bytesAxisFormat = createScaledAxisFormat({
  units: ["B", "KB", "MB", "GB", "TB"],
  base: 1024,
  formatValue: (value) => formatBytes(value),
  fractionDigits: (scaled, unitIndex) =>
    scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2,
});

export const mbpsAxisFormat: ChartAxisFormat = {
  formatValue: formatSpeedMbps,
  formatAxisTick: (value) => formatAxisTickNumber(value, value >= 10 ? 0 : 1),
  axisUnitLabel: () => "Mbps",
};

export const millisecondsAxisFormat: ChartAxisFormat = {
  formatValue: formatSpeedtestLatency,
  formatAxisTick: (value) => formatAxisTickNumber(value, 0),
  axisUnitLabel: () => "ms",
};

export const percentAxisFormat: ChartAxisFormat = {
  formatValue: (value) => formatPercentValue(value, 1),
  formatAxisTick: (value) => formatAxisTickNumber(value, value >= 10 ? 0 : 1),
  axisUnitLabel: () => "%",
};

export const celsiusAxisFormat: ChartAxisFormat = {
  formatValue: (value) => formatCelsius(value, 1),
  formatAxisTick: (value) => formatAxisTickNumber(value, value >= 10 ? 0 : 1),
  axisUnitLabel: () => "°C",
};

export const countAxisFormat: ChartAxisFormat = {
  formatValue: (value) => formatPlayers(value),
  formatAxisTick: (value) => formatPlayersAxisTick(value),
  axisUnitLabel: () => "",
};
