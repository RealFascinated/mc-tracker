import { describe, expect, it } from "vitest";

import { chartXWindowKey, resolveChartXWindow } from "@/lib/metrics/chart-zoom";
import { metricTimeWindowToEpochWindow } from "@/lib/metrics/time-window";

describe("chartXWindowKey", () => {
  it("keeps a stable key for custom windows across data refetch", () => {
    const window = { kind: "custom" as const, from: 1_000, to: 2_000 };
    const key = chartXWindowKey(window, { from: 1_000, to: 2_000 });

    expect(key).toBe("custom:1000:2000");
    expect(chartXWindowKey(window, { from: 1_050, to: 2_050 })).toBe(key);
  });

  it("updates preset keys when fetched bounds roll forward", () => {
    const window = { kind: "preset" as const, range: "7d" as const };
    const first = chartXWindowKey(window, { from: 100, to: 200 });
    const second = chartXWindowKey(window, { from: 150, to: 250 });

    expect(first).not.toBe(second);
  });
});

describe("resolveChartXWindow", () => {
  it("uses URL bounds for custom windows", () => {
    expect(
      resolveChartXWindow({ kind: "custom", from: 1_000, to: 9_999_999 }),
    ).toEqual({ from: 1_000, to: expect.any(Number) });
  });

  it("uses the selected preset lookback for preset windows", () => {
    const resolved = resolveChartXWindow({ kind: "preset", range: "24h" });
    const expected = metricTimeWindowToEpochWindow({
      kind: "preset",
      range: "24h",
    });

    expect(resolved.to - resolved.from).toBeCloseTo(
      expected.to - expected.from,
      -2,
    );
  });
});
