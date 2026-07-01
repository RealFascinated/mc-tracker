import { Link } from "@tanstack/react-router";

import { EntityCardStats } from "@/components/dashboard/grids/entity-metrics-grid";
import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import type { AsnDetailResponse } from "@/lib/api/asns";
import { asnDetailSearch, asnDisplayName } from "@/lib/api/asns";
import { cn } from "cnfast";

type AsnIdentityHeaderProps = {
  asn: Pick<AsnDetailResponse, "asn" | "asnOrg" | "playersOnline" | "peaks">;
  linkToDetail?: boolean;
  layout?: "card" | "page";
};

export function AsnIdentityHeader({
  asn,
  linkToDetail = false,
  layout = "card",
}: AsnIdentityHeaderProps) {
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const displayName = asnDisplayName(asn);
  const nameContent = (
    <div className="entity-metrics-name">{displayName}</div>
  );

  return (
    <div
      className={cn(
        layout === "page"
          ? "server-detail-header"
          : "entity-metrics-card-header",
      )}
    >
      <div className="entity-metrics-identity">
        <div className="min-w-0">
          <div className="entity-metrics-title-row">
            {linkToDetail ? (
              <Link
                to="/asns/$asn"
                params={{ asn: asn.asn }}
                search={asnDetailSearch(asn.asnOrg, timeWindowSearch)}
                className="min-w-0 hover:text-monitor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monitor dark:hover:text-warning dark:focus-visible:ring-warning"
              >
                {nameContent}
              </Link>
            ) : (
              nameContent
            )}
          </div>
          <div className="entity-metrics-subtitle">
            {asn.asn || "Unknown ASN"}
          </div>
        </div>
      </div>

      <EntityCardStats
        playersOnline={asn.playersOnline}
        peaks={asn.peaks}
      />
    </div>
  );
}
