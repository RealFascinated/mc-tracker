import { Link } from "@tanstack/react-router";

import {
  EntityCardStats,
  EntityMetricsGrid,
} from "@/components/dashboard/grids/entity-metrics-grid";
import type { AsnListItem, AsnTimeseriesResponse } from "@/lib/api/asns";
import { asnDisplayName, asnDetailSearch } from "@/lib/api/asns";
import { asnTimeseriesQueryOptions } from "@/lib/api/asns.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { createPlayersChart } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type AsnMetricsGridProps = {
  asns: AsnListItem[];
  window: MetricTimeWindow;
  trackedAsns: number;
};

function AsnMetricsCardHeader({ asn }: { asn: AsnListItem }) {
  return (
    <div className="entity-metrics-card-header">
      <div className="entity-metrics-identity">
        <div className="min-w-0">
          <div className="entity-metrics-name">
            <Link
              to="/asns/$asn"
              params={{ asn: asn.asn }}
              search={asnDetailSearch(asn.asnOrg)}
              className="hover:text-monitor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monitor dark:hover:text-warning dark:focus-visible:ring-warning"
            >
              {asnDisplayName(asn)}
            </Link>
          </div>
          <div className="entity-metrics-subtitle">
            {asn.asn || "Unknown ASN"}
            {asn.serverCount > 0
              ? ` · ${asn.serverCount} server${asn.serverCount === 1 ? "" : "s"}`
              : ""}
          </div>
        </div>
      </div>

      <EntityCardStats playersOnline={asn.playersOnline} peaks={asn.peaks} />
    </div>
  );
}

export function AsnMetricsGrid({
  asns,
  window,
  trackedAsns,
}: AsnMetricsGridProps) {
  return (
    <EntityMetricsGrid<AsnListItem, AsnTimeseriesResponse>
      items={asns}
      window={window}
      hasActiveSearch={false}
      trackedCount={trackedAsns}
      getKey={(asn) => `${asn.asn}\u0000${asn.asnOrg}`}
      renderHeader={(asn) => <AsnMetricsCardHeader asn={asn} />}
      chartDef={(asn) => {
        const slug = `${asn.asn}-${asn.asnOrg}`.replace(
          /[^a-zA-Z0-9_-]+/g,
          "-",
        );
        return createPlayersChart(`asn-players-${slug}`);
      }}
      timeseriesOptions={(asn, timeWindow) =>
        toVisibleTimeseriesOptions(
          asnTimeseriesQueryOptions(asn.asn, asn.asnOrg, timeWindow),
        )
      }
      timeseriesEnabled={(asn) => asn.asn.length > 0}
      section={{
        title: "Per ASN",
        subtitleDefault: "Player history grouped by network",
        subtitleSearch: (shown, total) =>
          `Showing ${shown} of ${total} networks`,
        emptyTracked: "No networks are being tracked yet.",
        emptySearch: "No networks to show.",
        emptySearchHint: "Networks appear here once servers are tracked.",
      }}
    />
  );
}
