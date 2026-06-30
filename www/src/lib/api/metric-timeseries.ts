export type MetricTimeSeries = {
  from: number
  to: number
  step: number | null
  timestamps: number[]
  series: Record<string, Array<number | null>>
}

export function buildMetricTimeSeries(input: {
  timestamps: number[]
  series: Record<string, Array<number | null>>
  step?: number | null
  from?: number
  to?: number
}): MetricTimeSeries {
  const from = input.from ?? input.timestamps.at(0) ?? 0
  const to = input.to ?? input.timestamps.at(-1) ?? from
  return {
    from,
    to,
    step: input.step ?? null,
    timestamps: input.timestamps,
    series: input.series,
  }
}

function buildMetricTimeGrid(
  from: number,
  to: number,
  step: number,
): number[] {
  const start = from - (from % step)
  const timestamps: number[] = []
  for (let timestamp = start; timestamp <= to; timestamp += step) {
    timestamps.push(timestamp)
  }
  return timestamps
}

/** Expand sparse API points onto the full `from`/`to`/`step` window for charting. */
export function backfillMetricTimeSeries(
  data: MetricTimeSeries,
): MetricTimeSeries {
  const step = data.step
  if (step == null || step <= 0) {
    return data
  }

  const timestamps = buildMetricTimeGrid(data.from, data.to, step)
  if (timestamps.length === 0) {
    return data
  }

  const valueMaps = new Map<string, Map<number, number | null>>()
  for (const [key, values] of Object.entries(data.series)) {
    const map = new Map<number, number | null>()
    data.timestamps.forEach((timestamp, index) => {
      map.set(timestamp, values[index] ?? null)
    })
    valueMaps.set(key, map)
  }

  const series: Record<string, Array<number | null>> = {}
  for (const key of Object.keys(data.series)) {
    const map = valueMaps.get(key)
    series[key] = timestamps.map((timestamp) => map?.get(timestamp) ?? null)
  }

  return {
    from: data.from,
    to: data.to,
    step,
    timestamps,
    series,
  }
}
