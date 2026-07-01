import { useMemo } from "react";

import { DashboardRangeToggle } from "@/components/dashboard/dashboard-range-toggle";
import type { DashboardRangeOption } from "@/components/dashboard/dashboard-range-toggle";
import {
  EntityMetricsGrid
  
} from "@/components/dashboard/grids/entity-metrics-grid";
import type {EntityMetricsSectionCopy} from "@/components/dashboard/grids/entity-metrics-grid";
import { ServerIdentityHeader } from "@/components/dashboard/server-identity-header";
import { SERVER_PLATFORM_FILTER_OPTIONS } from "@/lib/api/platform";
import type { ServerPlatformFilter } from "@/lib/api/platform";
import type { ServerListItem, ServerTimeseriesResponse } from "@/lib/api/servers";
import { serverTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { createPlayersChart } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

const SERVER_PLATFORM_FILTER_TOGGLE_OPTIONS: Array<
  DashboardRangeOption<ServerPlatformFilter>
> = SERVER_PLATFORM_FILTER_OPTIONS.map((option) => ({
  value: option.value,
  shortLabel: option.shortLabel,
  label: option.label,
}));

type ServerMetricsGridProps = {
  servers: ServerListItem[];
  window: MetricTimeWindow;
  platformFilter: ServerPlatformFilter;
  onPlatformFilterChange: (platform: ServerPlatformFilter) => void;
  trackedServers: number;
  section?: EntityMetricsSectionCopy;
};

function serverGridEmptyCopy(platformFilter: ServerPlatformFilter): {
  emptyFiltered: string;
  emptyFilteredHint: string;
} {
  if (platformFilter === "PC") {
    return {
      emptyFiltered: "No Java servers to show.",
      emptyFilteredHint: "Switch to All or Bedrock, or track a Java server.",
    };
  }

  if (platformFilter === "PE") {
    return {
      emptyFiltered: "No Bedrock servers to show.",
      emptyFilteredHint: "Switch to All or Java, or track a Bedrock server.",
    };
  }

  return {
    emptyFiltered: "No servers to show.",
    emptyFilteredHint: "Try a different platform filter.",
  };
}

export function ServerMetricsGrid({
  servers,
  window,
  platformFilter,
  onPlatformFilterChange,
  trackedServers,
  section,
}: ServerMetricsGridProps) {
  const hasActivePlatformFilter = platformFilter !== "all";
  const emptyCopy = serverGridEmptyCopy(platformFilter);
  const headerTrailing = useMemo(
    () => (
      <DashboardRangeToggle
        value={platformFilter}
        options={SERVER_PLATFORM_FILTER_TOGGLE_OPTIONS}
        onValueChange={onPlatformFilterChange}
        aria-label="Server platform"
      />
    ),
    [onPlatformFilterChange, platformFilter],
  );

  return (
    <EntityMetricsGrid<ServerListItem, ServerTimeseriesResponse>
      items={servers}
      window={window}
      hasActiveFilter={hasActivePlatformFilter}
      trackedCount={trackedServers}
      headerTrailing={headerTrailing}
      getKey={(server) => server.id}
      renderHeader={(server) => (
        <ServerIdentityHeader server={server} linkToDetail />
      )}
      chartDef={(server) => createPlayersChart(`server-players-${server.id}`)}
      timeseriesOptions={(server, timeWindow) =>
        toVisibleTimeseriesOptions(
          serverTimeseriesQueryOptions(server.id, timeWindow),
        )
      }
      timeseriesEnabled={(server) => server.id.length > 0}
      section={
        section ?? {
          title: "Per server",
          subtitleDefault: "Player history for each tracked server",
          subtitleFiltered: (shown, total) =>
            `Showing ${shown} of ${total} servers`,
          emptyTracked: "No servers are being tracked yet.",
          emptyFiltered: emptyCopy.emptyFiltered,
          emptyFilteredHint: emptyCopy.emptyFilteredHint,
        }
      }
    />
  );
}
