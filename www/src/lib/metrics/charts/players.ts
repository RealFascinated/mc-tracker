import type { ChartDefinition } from "@/lib/metrics/charts/types"

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
    left: { unit: "count", yRange: "auto" },
  },
}

export function serverPlayersChart(id: string): ChartDefinition {
  return {
    id: `server-players-${id}`,
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
      left: { unit: "count", yRange: "auto" },
    },
  }
}
