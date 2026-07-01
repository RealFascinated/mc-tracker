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

  return (abs >= 100_000 ? playersCompactFormatter0 : playersCompactFormatter1).format(
    rounded,
  );
}
