export function formatPeakAt(epochSeconds: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(epochSeconds * 1000));
}

export function peakTimestampTooltip(
  timestamp: number | null | undefined,
): string | undefined {
  if (timestamp == null) {
    return undefined;
  }

  return `Peak on ${formatPeakAt(timestamp)}`;
}
