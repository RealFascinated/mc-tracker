import { describe, expect, it } from "vitest"

import { buildMetricTimeSeries } from "@/lib/api/metric-timeseries"
import { sumPlayersOnlineSeries } from "@/lib/metrics/aggregate"

describe("sumPlayersOnlineSeries", () => {
  it("sums aligned player counts across servers", () => {
    const first = buildMetricTimeSeries({
      from: 0,
      to: 60,
      step: 30,
      timestamps: [0, 30, 60],
      series: { players_online: [1, 2, null] },
    })
    const second = buildMetricTimeSeries({
      from: 0,
      to: 60,
      step: 30,
      timestamps: [0, 30, 60],
      series: { players_online: [4, null, 6] },
    })

    const total = sumPlayersOnlineSeries([first, second])

    expect(total?.series.players_online).toEqual([5, 2, 6])
  })

  it("returns null when no series are provided", () => {
    expect(sumPlayersOnlineSeries([])).toBeNull()
  })
})
