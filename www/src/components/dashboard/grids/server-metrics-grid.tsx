import {
  EntityCardStats,
  EntityMetricsGrid,
} from "@/components/dashboard/grids/entity-metrics-grid";
import { ServerFavicon } from "@/components/dashboard/server-favicon";
import { ServerPlatformBadge } from "@/components/dashboard/server-platform-badge";
import type { ServerListItem, ServerTimeseriesResponse } from "@/lib/api/servers";
import { serverTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { serverPlayersChart } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type ServerMetricsGridProps = {
  servers: ServerListItem[];
  window: MetricTimeWindow;
  hasActiveSearch: boolean;
  trackedServers: number;
  isLoading?: boolean;
};

function ServerMetricsCardHeader({ server }: { server: ServerListItem }) {
  return (
    <div className="entity-metrics-card-header">
      <div className="entity-metrics-identity">
        <ServerFavicon name={server.name} favicon={server.favicon} size="md" />
        <div className="min-w-0">
          <div className="entity-metrics-title-row">
            <div className="entity-metrics-name">{server.name}</div>
            <ServerPlatformBadge type={server.type} />
          </div>
          <div className="entity-metrics-subtitle">
            {server.host}
            {server.port != null ? `:${server.port}` : ""}
          </div>
        </div>
      </div>

      <EntityCardStats
        playersOnline={server.playersOnline}
        peakPlayers24h={server.peakPlayers24h}
        peakPlayersAllTime={server.peakPlayersAllTime}
      />
    </div>
  );
}

export function ServerMetricsGrid({
  servers,
  window,
  hasActiveSearch,
  trackedServers,
  isLoading = false,
}: ServerMetricsGridProps) {
  return (
    <EntityMetricsGrid<ServerListItem, ServerTimeseriesResponse>
      items={servers}
      window={window}
      hasActiveSearch={hasActiveSearch}
      trackedCount={trackedServers}
      isLoading={isLoading}
      getKey={(server) => server.id}
      renderHeader={(server) => <ServerMetricsCardHeader server={server} />}
      chartDef={(server) => serverPlayersChart(server.id)}
      timeseriesOptions={(server, timeWindow) =>
        toVisibleTimeseriesOptions(
          serverTimeseriesQueryOptions(server.id, timeWindow) as {
            queryKey: readonly unknown[];
            queryFn?: (
              context: never,
            ) => ServerTimeseriesResponse | Promise<ServerTimeseriesResponse>;
            enabled?: boolean;
          },
        )
      }
      timeseriesEnabled={(server) => server.id.length > 0}
      section={{
        title: "Per server",
        subtitleDefault: "Player history for each tracked server",
        subtitleSearch: (shown, total) =>
          `Showing ${shown} of ${total} servers`,
        emptyTracked: "No servers are being tracked yet.",
        emptySearch: "No servers match your search.",
        emptySearchHint: "Try a different name, host, or network.",
      }}
    />
  );
}
