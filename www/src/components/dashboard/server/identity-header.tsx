import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { EntityCardStats } from "@/components/dashboard/grids/entity-metrics-grid";
import { useMetricTimeWindowLinkSearch } from "@/hooks/metrics/use-metric-time-window-link-search";
import { ServerFavicon } from "@/components/dashboard/server/favicon";
import type { ServerListItem } from "@/lib/api/servers";
import { formatServerHost } from "@/lib/api/servers";
import { ServerHostCopy } from "@/components/dashboard/server/host-copy";
import { ServerPlatformBadge } from "@/components/dashboard/server/platform-badge";
import { AsnHoverPreview } from "@/components/dashboard/server/asn-hover-preview";
import { asnDetailSearch, asnLabelOptional } from "@/lib/api/asns";
import { cn } from "cnfast";

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
  const asnName = asnLabelOptional(server);
  const address = formatServerHost(server.host, server.port);

  const nameContent = <div className="entity-metrics-name">{server.name}</div>;

  const linkedNameContent = (
    <Link
      to="/servers/$serverId"
      params={{ serverId: server.id }}
      search={timeWindowSearch}
      className="link-underline-animate link-underline-animate--primary entity-metrics-name min-w-0 transition-colors hover:text-monitor dark:hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monitor dark:focus-visible:ring-warning"
    >
      {server.name}
    </Link>
  );

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
              {linkToDetail ? linkedNameContent : nameContent}
              <ServerPlatformBadge platform={server.type} />
            </div>
            <div className="entity-metrics-subtitle">
              {layout === "card" ? (
                <ServerHostCopy
                  host={server.host}
                  port={server.port}
                  className="entity-metrics-subtitle-host"
                />
              ) : (
                <span className="entity-metrics-subtitle-host">{address}</span>
              )}
              {asnName ? (
                <>
                  <span className="entity-metrics-subtitle-sep" aria-hidden="true">
                    ·
                  </span>
                  {server.asn ? (
                    layout === "card" ? (
                      <AsnHoverPreview
                        asn={server.asn}
                        asnOrg={server.asnOrg}
                        label={asnName}
                        className="entity-metrics-subtitle-asn"
                      />
                    ) : (
                      <Link
                        to="/asns/$asn"
                        params={{ asn: server.asn }}
                        search={asnDetailSearch(
                          server.asnOrg,
                          timeWindowSearch,
                        )}
                        className="link-underline-animate link-underline-animate--primary entity-metrics-subtitle-asn hover:text-monitor dark:hover:text-warning"
                        title={asnName}
                      >
                        {asnName}
                      </Link>
                    )
                  ) : (
                    <span className="entity-metrics-subtitle-asn" title={asnName}>
                      {asnName}
                    </span>
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
