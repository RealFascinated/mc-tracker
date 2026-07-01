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
