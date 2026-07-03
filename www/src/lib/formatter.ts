export function formatNetworkBps(bps: number): string {
  const units = ["bps", "Kbps", "Mbps", "Gbps"];
  let value = bps;
  let unitIndex = 0;

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }

  const decimals = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${formatDecimal(value, decimals)} ${units[unitIndex]}`;
}

const DECIMAL_FORMATTER_0 = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});
const DECIMAL_FORMATTER_1 = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const DECIMAL_FORMATTER_2 = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const decimalFormatters = new Map<number, Intl.NumberFormat>([
  [0, DECIMAL_FORMATTER_0],
  [1, DECIMAL_FORMATTER_1],
  [2, DECIMAL_FORMATTER_2],
]);

function getDecimalFormatter(fractionDigits: number): Intl.NumberFormat {
  return decimalFormatters.get(fractionDigits) ?? DECIMAL_FORMATTER_0;
}

export function formatDecimal(value: number, fractionDigits: number): string {
  return getDecimalFormatter(fractionDigits).format(value);
}

export function formatPercentValue(value: number, fractionDigits = 1): string {
  return `${formatDecimal(value, fractionDigits)}%`;
}

export function formatCelsius(value: number, fractionDigits = 0): string {
  return `${formatDecimal(value, fractionDigits)}°C`;
}

const tooltipTimestampFormatterWithYear = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const tooltipTimestampFormatterWithYearAndSecond = new Intl.DateTimeFormat(
  undefined,
  {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  },
);

const tooltipTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const tooltipTimestampFormatterWithSecond = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

export function formatTooltipTimestamp(
  timestamp: number,
  rangeSeconds: number,
): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const includeYear =
    date.getFullYear() !== now.getFullYear() || rangeSeconds > 86_400 * 180;
  const includeSecond = rangeSeconds <= 86_400;

  if (includeYear) {
    return includeSecond
      ? tooltipTimestampFormatterWithYearAndSecond.format(date)
      : tooltipTimestampFormatterWithYear.format(date);
  }

  return includeSecond
    ? tooltipTimestampFormatterWithSecond.format(date)
    : tooltipTimestampFormatter.format(date);
}

export type EpochRangeParts = {
  headline: string;
  span: string | null;
};

function epochDateParts(epoch: number) {
  const date = new Date(epoch * 1000);
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();
  return { date, includeYear };
}

const epochTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const epochDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const epochDateWithYearFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatEpochTime(date: Date): string {
  return epochTimeFormatter.format(date);
}

function formatEpochDate(date: Date, includeYear: boolean): string {
  return includeYear
    ? epochDateWithYearFormatter.format(date)
    : epochDateFormatter.format(date);
}

export function formatEpochRangeParts(
  startEpoch: number,
  endEpoch: number | null,
): EpochRangeParts {
  const { date: start, includeYear } = epochDateParts(startEpoch);
  if (Number.isNaN(start.getTime())) {
    return { headline: "—", span: null };
  }

  const startTime = formatEpochTime(start);

  if (endEpoch == null) {
    return {
      headline: formatEpochDate(start, includeYear),
      span: `${startTime} – ongoing`,
    };
  }

  const { date: end, includeYear: endIncludeYear } = epochDateParts(endEpoch);
  if (Number.isNaN(end.getTime())) {
    return {
      headline: formatEpochDate(start, includeYear),
      span: `${startTime} – ongoing`,
    };
  }

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return {
      headline: formatEpochDate(start, includeYear),
      span: `${startTime} – ${formatEpochTime(end)}`,
    };
  }

  const endDateLabel = formatEpochDate(end, includeYear || endIncludeYear);
  return {
    headline: `${formatEpochDate(start, includeYear)}, ${startTime} – ${endDateLabel}, ${formatEpochTime(end)}`,
    span: null,
  };
}

const DAY_SECONDS = 86_400;
const MONTH_SECONDS = 86_400 * 28;
const YEAR_SECONDS = 86_400 * 365;

const chartYearFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
});
const chartMonthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
});
const chartMonthYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});
const chartMonthDayFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const chartMonthDayYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const chartTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const chartTimeWithSecondFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

export function formatChartAxisTicks(
  splits: Array<number>,
  foundIncr: number,
): Array<string> {
  let prevYear: number | undefined;
  let prevDay: number | undefined;

  const formatYear = (date: Date) => chartYearFormatter.format(date);
  const formatMonth = (date: Date) => chartMonthFormatter.format(date);
  const formatMonthYear = (date: Date) => chartMonthYearFormatter.format(date);
  const formatMonthDay = (date: Date) => chartMonthDayFormatter.format(date);
  const formatMonthDayYear = (date: Date) =>
    chartMonthDayYearFormatter.format(date);
  const formatTime = (date: Date) =>
    (foundIncr < 60 ? chartTimeWithSecondFormatter : chartTimeFormatter).format(
      date,
    );

  return splits.map((split) => {
    const date = new Date(split * 1000);
    const year = date.getFullYear();
    const day = date.getDate();

    const atYearBoundary = prevYear !== undefined && year !== prevYear;
    const atDayBoundary = prevDay !== undefined && day !== prevDay;

    prevYear = year;
    prevDay = day;

    if (foundIncr >= YEAR_SECONDS) return formatYear(date);
    if (foundIncr >= MONTH_SECONDS)
      return atYearBoundary ? formatMonthYear(date) : formatMonth(date);
    if (foundIncr >= DAY_SECONDS)
      return atYearBoundary ? formatMonthDayYear(date) : formatMonthDay(date);
    if (atDayBoundary) return formatMonthDay(date);
    return formatTime(date);
  });
}

const playersFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const playersCompactFormatter0 = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 0,
});

const playersCompactFormatter1 = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatPlayers(count: number | null | undefined): string {
  if (count == null || Number.isNaN(count)) {
    return "—";
  }

  return playersFormatter.format(Math.round(count));
}

/** Compact labels for chart Y-axis ticks (avoids gutter overflow). */
export function formatPlayersAxisTick(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);

  if (abs < 1_000) {
    return playersFormatter.format(rounded);
  }

  return (
    abs >= 100_000 ? playersCompactFormatter0 : playersCompactFormatter1
  ).format(rounded);
}

const peakTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function peakTimestampTooltip(
  timestamp: number | null | undefined,
): string | undefined {
  if (timestamp == null) {
    return undefined;
  }

  const formatted = peakTimestampFormatter.format(new Date(timestamp));

  return `Peak on ${formatted}`;
}
