export function peakTimestampTooltip(
  timestamp: number | null | undefined,
): string | undefined {
  if (timestamp == null) {
    return undefined;
  }

  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));

  return `Peak on ${formatted}`;
}
