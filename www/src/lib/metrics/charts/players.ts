import type { ChartDefinition, YRangeSpec } from "@/lib/metrics/charts/types";

function createPlayersChart(
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

export function serverPlayersChart(id: string): ChartDefinition {
  return createPlayersChart(`server-players-${id}`);
}

export function asnPlayersChart(asn: string, asnOrg: string): ChartDefinition {
  const slug = `${asn}-${asnOrg}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return createPlayersChart(`asn-players-${slug}`);
}
