import {
  EntityCardStats,
  EntityMetricsGrid,
} from "@/components/dashboard/grids/entity-metrics-grid";
import { ServerFavicon } from "@/components/dashboard/server-favicon";
import type {
  ServerListItem,
  ServerTimeseriesResponse,
} from "@/lib/api/servers";
import { serverTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { createPlayersChart } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { cn } from "@/lib/utils";

type ServerMetricsGridProps = {
  servers: ServerListItem[];
  window: MetricTimeWindow;
  hasActiveSearch: boolean;
  trackedServers: number;
  isLoading?: boolean;
};

function serverAsnName(server: ServerListItem): string | null {
  if (server.asnOrg) {
    return server.asnOrg;
  }
  if (server.asn) {
    return server.asn;
  }
  return null;
}

function ServerMetricsCardHeader({ server }: { server: ServerListItem }) {
  const asnName = serverAsnName(server);

  return (
    <div className="entity-metrics-card-header">
      <div className="entity-metrics-identity">
        <ServerFavicon name={server.name} favicon={server.favicon} size="md" />
        <div className="min-w-0">
          <div className="entity-metrics-title-row">
            <div className="entity-metrics-name">{server.name}</div>
            <span
              className={cn(
                "server-platform-badge",
                server.type === "PE" && "server-platform-badge-pe",
              )}
            >
              {server.type}
            </span>
          </div>
          <div className="entity-metrics-subtitle">
            {server.host}
            {server.port != null ? `:${server.port}` : ""}
            {asnName ? ` · ${asnName}` : ""}
          </div>
        </div>
      </div>

      <EntityCardStats
        playersOnline={server.playersOnline}
        peaks={server.peaks}
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
      chartDef={(server) => createPlayersChart(`server-players-${server.id}`)}
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
