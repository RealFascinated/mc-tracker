const DAY_SECONDS = 86_400;
const MONTH_SECONDS = DAY_SECONDS * 28;
const YEAR_SECONDS = DAY_SECONDS * 365;
const THIRTY_DAYS_MS = 30 * DAY_SECONDS * 1000;

const dateTime = {
  monthDay: new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }),
  monthDayYear: new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
  month: new Intl.DateTimeFormat(undefined, { month: "short" }),
  monthYear: new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }),
  year: new Intl.DateTimeFormat(undefined, { year: "numeric" }),
  time: new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }),
  timeWithSeconds: new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }),
  time24: new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  weekdayMonthDay: new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }),
  weekdayMonthDayYear: new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
  monthDayTime: new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }),
  monthDayYearTime: new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }),
  monthDayTimeWithSeconds: new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }),
  monthDayYearTimeWithSeconds: new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }),
  mediumDateTime: new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }),
  quotaReset: new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }),
};

const localeIntegerFormatter = new Intl.NumberFormat(undefined);

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function includeYear(date: Date, now = new Date()): boolean {
  return date.getFullYear() !== now.getFullYear();
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatMonthDay(value: Date | string | number): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return dateTime.monthDay.format(date);
}

export function formatMediumDateTime(value: Date | string | number): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return dateTime.mediumDateTime.format(date);
}

export function formatQuotaResetAt(value: Date | string | number): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return dateTime.quotaReset.format(date);
}

export function formatLocaleInteger(value: number): string {
  return localeIntegerFormatter.format(value);
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

export function formatTooltipTimestamp(
  timestamp: number,
  rangeSeconds: number,
): string {
  const date = new Date(timestamp * 1000);
  const showYear = includeYear(date) || rangeSeconds > DAY_SECONDS * 180;
  const showSeconds = rangeSeconds <= DAY_SECONDS;

  if (showYear) {
    return showSeconds
      ? dateTime.monthDayYearTimeWithSeconds.format(date)
      : dateTime.monthDayYearTime.format(date);
  }

  return showSeconds
    ? dateTime.monthDayTimeWithSeconds.format(date)
    : dateTime.monthDayTime.format(date);
}

/** Relative label for recent dates; absolute date when older than 30 days. */
export function formatTimeAgo(
  value: Date | string | number,
  nowMs = Date.now(),
): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const ageMs = nowMs - date.getTime();
  if (ageMs >= THIRTY_DAYS_MS) {
    const now = new Date(nowMs);
    return includeYear(date, now)
      ? dateTime.monthDayYear.format(date)
      : dateTime.monthDay.format(date);
  }

  const divisions: Array<{
    amount: number;
    unit: Intl.RelativeTimeFormatUnit;
  }> = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 30, unit: "day" },
  ];

  let duration = -Math.round(ageMs / 1000);
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      break;
    }
    duration = Math.round(duration / division.amount);
    unit = division.unit;
  }

  return relativeTimeFormatter.format(duration, unit);
}

export type EpochRangeParts = {
  headline: string;
  span: string | null;
};

function epochDateParts(epoch: number) {
  const date = new Date(epoch * 1000);
  return { date, includeYear: includeYear(date) };
}

export function formatEpochRangeParts(
  startEpoch: number,
  endEpoch: number | null,
): EpochRangeParts {
  const { date: start, includeYear: startIncludeYear } =
    epochDateParts(startEpoch);
  if (Number.isNaN(start.getTime())) {
    return { headline: "—", span: null };
  }

  const startTime = dateTime.time24.format(start);

  if (endEpoch == null) {
    return {
      headline: startIncludeYear
        ? dateTime.weekdayMonthDayYear.format(start)
        : dateTime.weekdayMonthDay.format(start),
      span: `${startTime} – ongoing`,
    };
  }

  const { date: end, includeYear: endIncludeYear } = epochDateParts(endEpoch);
  if (Number.isNaN(end.getTime())) {
    return {
      headline: startIncludeYear
        ? dateTime.weekdayMonthDayYear.format(start)
        : dateTime.weekdayMonthDay.format(start),
      span: `${startTime} – ongoing`,
    };
  }

  const sameDay = isSameCalendarDay(start, end);

  const startDateLabel = startIncludeYear
    ? dateTime.weekdayMonthDayYear.format(start)
    : dateTime.weekdayMonthDay.format(start);

  if (sameDay) {
    return {
      headline: startDateLabel,
      span: `${startTime} – ${dateTime.time24.format(end)}`,
    };
  }

  const endDateLabel =
    endIncludeYear || startIncludeYear
      ? dateTime.weekdayMonthDayYear.format(end)
      : dateTime.weekdayMonthDay.format(end);

  return {
    headline: `${startDateLabel}, ${startTime} – ${endDateLabel}, ${dateTime.time24.format(end)}`,
    span: null,
  };
}

export function formatChartAxisTicks(
  splits: Array<number>,
  foundIncr: number,
): Array<string> {
  let prevYear: number | undefined;
  let prevDay: number | undefined;

  const formatTime = (date: Date) =>
    (foundIncr < 60 ? dateTime.timeWithSeconds : dateTime.time).format(date);

  return splits.map((split) => {
    const date = new Date(split * 1000);
    const year = date.getFullYear();
    const day = date.getDate();

    const atYearBoundary = prevYear !== undefined && year !== prevYear;
    const atDayBoundary = prevDay !== undefined && day !== prevDay;

    prevYear = year;
    prevDay = day;

    if (foundIncr >= YEAR_SECONDS) {
      return dateTime.year.format(date);
    }
    if (foundIncr >= MONTH_SECONDS) {
      return atYearBoundary
        ? dateTime.monthYear.format(date)
        : dateTime.month.format(date);
    }
    if (foundIncr >= DAY_SECONDS) {
      return atYearBoundary
        ? dateTime.monthDayYear.format(date)
        : dateTime.monthDay.format(date);
    }
    if (atDayBoundary) {
      return dateTime.monthDay.format(date);
    }
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

export function peakTimestampTooltip(
  timestamp: number | null | undefined,
): string | undefined {
  if (timestamp == null) {
    return undefined;
  }

  const formatted = formatMediumDateTime(timestamp);

  return `Peak on ${formatted}`;
}
