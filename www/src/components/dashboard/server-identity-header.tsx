import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { EntityCardStats } from "@/components/dashboard/grids/entity-metrics-grid";
import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import { ServerFavicon } from "@/components/dashboard/server-favicon";
import type { ServerListItem } from "@/lib/api/servers";
import { asnDetailSearch } from "@/lib/api/asns";
import {
  formatServerPlatformLabel,
  serverPlatformBadgeClassName,
} from "@/lib/api/platform";
import { cn } from "cnfast";

function serverAsnName(server: ServerListItem): string | null {
  if (server.asnOrg) {
    return server.asnOrg;
  }
  if (server.asn) {
    return server.asn;
  }
  return null;
}

function formatServerAddress(server: ServerListItem): string {
  if (server.port == null) {
    return server.host;
  }
  return `${server.host}:${server.port}`;
}

type ServerIdentityHeaderProps = {
  server: ServerListItem;
  linkToDetail?: boolean;
  layout?: "card" | "page";
  trailing?: ReactNode;
};

export function ServerIdentityHeader({
  server,
  linkToDetail = false,
  layout = "card",
  trailing,
}: ServerIdentityHeaderProps) {
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const asnName = serverAsnName(server);
  const address = formatServerAddress(server);

  const nameContent = <div className="entity-metrics-name">{server.name}</div>;

  return (
    <div
      className={cn(
        layout === "page"
          ? "server-detail-header"
          : "entity-metrics-card-header",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="entity-metrics-identity min-w-0 flex-1">
          <ServerFavicon
            name={server.name}
            favicon={server.favicon}
            size="md"
          />
          <div className="min-w-0">
            <div className="entity-metrics-title-row">
              {linkToDetail ? (
                <Link
                  to="/servers/$serverId"
                  params={{ serverId: server.id }}
                  search={timeWindowSearch}
                  className="min-w-0 hover:text-monitor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monitor dark:hover:text-warning dark:focus-visible:ring-warning"
                >
                  {nameContent}
                </Link>
              ) : (
                nameContent
              )}
              <span className={serverPlatformBadgeClassName(server.type)}>
                {formatServerPlatformLabel(server.type)}
              </span>
            </div>
            <div className="entity-metrics-subtitle">
              {address}
              {asnName ? (
                <>
                  {" · "}
                  {server.asn ? (
                    <Link
                      to="/asns/$asn"
                      params={{ asn: server.asn }}
                      search={asnDetailSearch(server.asnOrg, timeWindowSearch)}
                      className="hover:text-foreground hover:underline underline-offset-4"
                    >
                      {asnName}
                    </Link>
                  ) : (
                    asnName
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>

      <EntityCardStats
        playersOnline={server.playersOnline}
        peaks={server.peaks}
      />
    </div>
  );
}

export function ServerDetailMeta({ server }: { server: ServerListItem }) {
  const asnLabel = server.asnOrg || server.asn;

  return (
    <dl className="server-detail-meta">
      <div className="server-detail-meta-item">
        <dt>Address</dt>
        <dd className="font-mono">{formatServerAddress(server)}</dd>
      </div>
      {asnLabel ? (
        <div className="server-detail-meta-item">
          <dt>Network</dt>
          <dd>
            {server.asnOrg ? (
              <>
                {server.asnOrg}
                {server.asn ? (
                  <span className="text-muted-foreground"> ({server.asn})</span>
                ) : null}
              </>
            ) : (
              server.asn
            )}
          </dd>
        </div>
      ) : null}
      <div className="server-detail-meta-item">
        <dt>Platform</dt>
        <dd>
          <span className={serverPlatformBadgeClassName(server.type)}>
            {formatServerPlatformLabel(server.type)}
          </span>
        </dd>
      </div>
    </dl>
  );
}
