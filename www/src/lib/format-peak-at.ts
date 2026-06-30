export function peakTimestampTooltip(
  timestamp: number | null | undefined,
): string | undefined {
  if (timestamp == null) {
    return undefined;
  }

  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));

  return `Peak on ${formatted}`;
}
