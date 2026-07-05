import { useCallback, useMemo } from "react";

import { ServerSortToggle } from "@/components/dashboard/server/sort-toggle";
import { ServerPlatformFilterToggle } from "@/components/dashboard/server/platform-filter-toggle";
import { EntityMetricsGrid } from "@/components/dashboard/grids/entity-metrics-grid";
import type { EntityMetricsSectionCopy } from "@/components/dashboard/grids/entity-metrics-grid";
import { ServerIdentityHeader } from "@/components/dashboard/server/identity-header";
import { ServerPinButton } from "@/components/dashboard/server/pin-button";
import type { ServerPlatformFilter } from "@/lib/api/platform";
import { platformFilterEmptyCopy } from "@/lib/api/platform";
import type { ServerSort } from "@/lib/api/server-sort";
import type {
  ServerListItem,
  ServerTimeseriesResponse,
} from "@/lib/api/servers";
import { serverTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { createServerPlayersChart } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type ServerMetricsGridProps = {
  servers: ServerListItem[];
  window: MetricTimeWindow;
  platformFilter: ServerPlatformFilter;
  onPlatformFilterChange: (platform: ServerPlatformFilter) => void;
  sort: ServerSort;
  onSortChange: (sort: ServerSort) => void;
  trackedServers: number;
  section?: EntityMetricsSectionCopy;
  pinnedServerIds?: ReadonlySet<string>;
  showPinButtons?: boolean;
};

function ServerMetricsGridHeader({
  server,
  showPinButtons,
  pinnedServerIds,
}: {
  server: ServerListItem;
  showPinButtons: boolean;
  pinnedServerIds?: ReadonlySet<string>;
}) {
  const trailing = useMemo(() => {
    if (!showPinButtons) {
      return undefined;
    }

    return (
      <ServerPinButton
        serverId={server.id}
        isPinned={pinnedServerIds?.has(server.id) ?? false}
      />
    );
  }, [pinnedServerIds, server.id, showPinButtons]);

  return (
    <ServerIdentityHeader server={server} linkToDetail trailing={trailing} />
  );
}

export function ServerMetricsGrid({
  servers,
  window,
  platformFilter,
  onPlatformFilterChange,
  sort,
  onSortChange,
  trackedServers,
  section,
  pinnedServerIds,
  showPinButtons = false,
}: ServerMetricsGridProps) {
  const hasActivePlatformFilter = platformFilter !== "all";
  const emptyCopy = platformFilterEmptyCopy(platformFilter);
  const headerTrailing = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2">
        <ServerSortToggle value={sort} onValueChange={onSortChange} />
        <ServerPlatformFilterToggle
          value={platformFilter}
          onValueChange={onPlatformFilterChange}
        />
      </div>
    ),
    [onPlatformFilterChange, onSortChange, platformFilter, sort],
  );
  const renderHeader = useCallback(
    (server: ServerListItem) => (
      <ServerMetricsGridHeader
        server={server}
        showPinButtons={showPinButtons}
        pinnedServerIds={pinnedServerIds}
      />
    ),
    [pinnedServerIds, showPinButtons],
  );
  const chartDef = useCallback(
    (server: ServerListItem) =>
      createServerPlayersChart(`server-players-${server.id}`),
    [],
  );
  const timeseriesOptions = useCallback(
    (server: ServerListItem, timeWindow: MetricTimeWindow) =>
      toVisibleTimeseriesOptions(
        serverTimeseriesQueryOptions(server.id, timeWindow),
      ),
    [],
  );
  const sectionCopy = useMemo(
    () =>
      section ?? {
        title: "Servers",
        subtitleDefault: "Player history for each tracked server",
        subtitleFiltered: (shown: number, total: number) =>
          `Showing ${shown} of ${total} servers`,
        emptyTracked: "No servers are being tracked yet.",
        emptyFiltered: emptyCopy.emptyFiltered,
        emptyFilteredHint: emptyCopy.emptyFilteredHint,
      },
    [emptyCopy.emptyFiltered, emptyCopy.emptyFilteredHint, section],
  );

  return (
    <EntityMetricsGrid<ServerListItem, ServerTimeseriesResponse>
      items={servers}
      window={window}
      hasActiveFilter={hasActivePlatformFilter}
      trackedCount={trackedServers}
      headerTrailing={headerTrailing}
      getKey={(server) => server.id}
      renderHeader={renderHeader}
      chartDef={chartDef}
      timeseriesOptions={timeseriesOptions}
      timeseriesEnabled={(server) => server.id.length > 0}
      section={sectionCopy}
    />
  );
}
