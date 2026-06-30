const playersFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
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

  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: abs >= 100_000 ? 0 : 1,
  }).format(rounded);
}
