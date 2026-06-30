import {
  formatCelsius,
  formatNetworkBps,
  formatPercentValue,
} from "@/lib/formatter"

export type ChartAxisFormat = {
  formatValue: (value: number) => string
  formatAxisTick: (value: number, rangeMax: number) => string
  axisUnitLabel: (rangeMax: number) => string
}

function formatDecimal(value: number, fractionDigits: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value)
}

function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let scaled = Math.max(value, 0)
  let unitIndex = 0

  while (scaled >= 1024 && unitIndex < units.length - 1) {
    scaled /= 1024
    unitIndex += 1
  }

  const fractionDigits =
    scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2
  return `${formatDecimal(scaled, fractionDigits)} ${units[unitIndex]}`
}

function formatSpeedMbps(value: number): string {
  return value >= 10
    ? `${formatDecimal(value, 0)} Mbps`
    : `${formatDecimal(value, 1)} Mbps`
}

function formatSpeedtestLatency(value: number): string {
  return `${formatDecimal(value, 0)} ms`
}

function createScaledAxisFormat({
  units,
  base,
  formatValue,
  fractionDigits,
}: {
  units: ReadonlyArray<string>
  base: 1000 | 1024
  formatValue: (value: number) => string
  fractionDigits: (scaled: number, unitIndex: number) => number
}): ChartAxisFormat {
  function scaleForRange(rangeMax: number) {
    let probe = Math.max(rangeMax, 0)
    let unitIndex = 0
    while (probe >= base && unitIndex < units.length - 1) {
      probe /= base
      unitIndex += 1
    }
    const divisor = base ** unitIndex
    return { divisor, unitIndex }
  }

  return {
    formatValue,
    formatAxisTick: (value, rangeMax) => {
      const { divisor, unitIndex } = scaleForRange(rangeMax)
      const scaled = value / divisor
      return formatDecimal(scaled, fractionDigits(scaled, unitIndex))
    },
    axisUnitLabel: (rangeMax) => {
      const { unitIndex } = scaleForRange(rangeMax)
      return units[unitIndex] ?? ""
    },
  }
}

export const networkBpsAxisFormat = createScaledAxisFormat({
  units: ["bps", "Kbps", "Mbps", "Gbps"],
  base: 1000,
  formatValue: formatNetworkBps,
  fractionDigits: (scaled, unitIndex) =>
    scaled >= 10 || unitIndex === 0 ? 0 : 1,
})

export const bytesAxisFormat = createScaledAxisFormat({
  units: ["B", "KB", "MB", "GB", "TB"],
  base: 1024,
  formatValue: (value) => formatBytes(value),
  fractionDigits: (scaled, unitIndex) =>
    scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2,
})

export const mbpsAxisFormat: ChartAxisFormat = {
  formatValue: formatSpeedMbps,
  formatAxisTick: (value) =>
    value >= 10 ? formatDecimal(value, 0) : formatDecimal(value, 1),
  axisUnitLabel: () => "Mbps",
}

export const millisecondsAxisFormat: ChartAxisFormat = {
  formatValue: formatSpeedtestLatency,
  formatAxisTick: (value) => formatDecimal(value, 0),
  axisUnitLabel: () => "ms",
}

export const percentAxisFormat: ChartAxisFormat = {
  formatValue: (value) => formatPercentValue(value, 1),
  formatAxisTick: (value) => formatDecimal(value, value >= 10 ? 0 : 1),
  axisUnitLabel: () => "%",
}

export const celsiusAxisFormat: ChartAxisFormat = {
  formatValue: (value) => formatCelsius(value, 1),
  formatAxisTick: (value) => formatDecimal(value, value >= 10 ? 0 : 1),
  axisUnitLabel: () => "°C",
}

export const countAxisFormat: ChartAxisFormat = {
  formatValue: (value) => String(Math.round(value)),
  formatAxisTick: (value) => String(Math.round(value)),
  axisUnitLabel: () => "",
}
