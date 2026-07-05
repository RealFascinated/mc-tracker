import { Link } from "@tanstack/react-router";

import {
  EntityCardStats,
  EntityMetricsGrid,
} from "@/components/dashboard/grids/entity-metrics-grid";
import { useMetricTimeWindowLinkSearch } from "@/hooks/metrics/use-metric-time-window-link-search";
import type { AsnListItem, AsnTimeseriesResponse } from "@/lib/api/asns";
import { asnChartSlug, asnDisplayName, asnDetailSearch } from "@/lib/api/asns";
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
  const timeWindowSearch = useMetricTimeWindowLinkSearch();

  return (
    <div className="entity-metrics-card-header">
      <div className="entity-metrics-identity">
        <div className="min-w-0">
          <div className="entity-metrics-name">
            {asn.asn ? (
              <Link
                to="/asns/$asn"
                params={{ asn: asn.asn }}
                search={asnDetailSearch(asn.asnOrg, timeWindowSearch)}
                className="hover:text-monitor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monitor dark:hover:text-warning dark:focus-visible:ring-warning"
              >
                {asnDisplayName(asn)}
              </Link>
            ) : (
              asnDisplayName(asn)
            )}
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
      trackedCount={trackedAsns}
      getKey={(asn) => `${asn.asn}\u0000${asn.asnOrg}`}
      renderHeader={(asn) => <AsnMetricsCardHeader asn={asn} />}
      chartDef={(asn) => {
        const slug = asnChartSlug(asn.asn, asn.asnOrg);
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
        subtitleFiltered: (shown, total) =>
          `Showing ${shown} of ${total} networks`,
        emptyTracked: "No networks are being tracked yet.",
        emptyFiltered: "No networks to show.",
        emptyFilteredHint: "Networks appear here once servers are tracked.",
      }}
    />
  );
}
