export function formatPeakAt(epochSeconds: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(epochSeconds * 1000));
}

export function peakAllTimeTooltip(
  peak: { at: number } | null | undefined,
): string | undefined {
  if (peak?.at == null) {
    return undefined;
  }

  return `Peak on ${formatPeakAt(peak.at)}`;
}
