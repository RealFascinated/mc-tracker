export function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

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

function formatDecimal(value: number, fractionDigits: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercentValue(value: number, fractionDigits = 1): string {
  return `${formatDecimal(value, fractionDigits)}%`;
}

export function formatCelsius(value: number, fractionDigits = 0): string {
  return `${formatDecimal(value, fractionDigits)}°C`;
}

export function formatTooltipTimestamp(
  timestamp: number,
  rangeSeconds: number,
): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const includeYear =
    date.getFullYear() !== now.getFullYear() || rangeSeconds > 86_400 * 180;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    ...(rangeSeconds <= 86_400 ? { second: "2-digit" } : {}),
  }).format(date);
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

function formatEpochTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatEpochDate(date: Date, includeYear: boolean): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
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

export function formatChartAxisTicks(
  splits: Array<number>,
  foundIncr: number,
): Array<string> {
  let prevYear: number | undefined;
  let prevDay: number | undefined;

  const formatYear = (date: Date) =>
    new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(date);

  const formatMonth = (date: Date) =>
    new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);

  const formatMonthYear = (date: Date) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      year: "numeric",
    }).format(date);

  const formatMonthDay = (date: Date) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);

  const formatMonthDayYear = (date: Date) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);

  const formatTime = (date: Date) =>
    new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      ...(foundIncr < 60 ? { second: "2-digit" } : {}),
    }).format(date);

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
