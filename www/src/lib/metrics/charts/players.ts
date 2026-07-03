import type { ChartDefinition, YRangeSpec } from "@/lib/metrics/charts/types";

export function createPlayersChart(
  id: string,
  yRange: YRangeSpec = "auto",
): ChartDefinition {
  return {
    id,
    title: "",
    series: [
      {
        key: "players_online",
        label: "Players",
        unit: "count",
        axis: "left",
        fill: true,
      },
    ],
    axes: {
      left: { unit: "count", yRange },
    },
  };
}

export function createServerPlayersChart(
  id: string,
  yRange: YRangeSpec = "auto",
): ChartDefinition {
  return createPlayersChart(id, yRange);
}

export const totalPlayersChart: ChartDefinition = {
  id: "total-players",
  title: "Total players",
  series: [
    {
      key: "players_online",
      label: "Players",
      unit: "count",
      axis: "left",
      fill: true,
    },
  ],
  axes: {
    left: { unit: "count", yRange: "autoMin" },
  },
};
