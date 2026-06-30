import {
  EntityCardStats,
  EntityMetricsGrid,
} from "@/components/dashboard/grids/entity-metrics-grid";
import type { AsnListItem, AsnTimeseriesResponse } from "@/lib/api/asns";
import { asnListKey } from "@/lib/api/asns";
import { asnTimeseriesQueryOptions } from "@/lib/api/asns.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { asnPlayersChart } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";

type AsnMetricsGridProps = {
  asns: AsnListItem[];
  window: MetricTimeWindow;
  hasActiveSearch: boolean;
  trackedAsns: number;
  isLoading?: boolean;
};

function asnDisplayName(asn: AsnListItem): string {
  if (asn.asnOrg) {
    return asn.asnOrg;
  }
  if (asn.asn) {
    return asn.asn;
  }
  return "Unknown network";
}

function AsnMetricsCardHeader({ asn }: { asn: AsnListItem }) {
  return (
    <div className="entity-metrics-card-header">
      <div className="entity-metrics-identity">
        <div className="min-w-0">
          <div className="entity-metrics-name">{asnDisplayName(asn)}</div>
          <div className="entity-metrics-subtitle">
            {asn.asn || "Unknown ASN"}
            {asn.serverCount > 0
              ? ` · ${asn.serverCount} server${asn.serverCount === 1 ? "" : "s"}`
              : ""}
          </div>
        </div>
      </div>

      <EntityCardStats
        playersOnline={asn.playersOnline}
        peakPlayers24h={asn.peakPlayers24h}
        peakPlayersAllTime={asn.peakPlayersAllTime}
      />
    </div>
  );
}

export function AsnMetricsGrid({
  asns,
  window,
  hasActiveSearch,
  trackedAsns,
  isLoading = false,
}: AsnMetricsGridProps) {
  return (
    <EntityMetricsGrid<AsnListItem, AsnTimeseriesResponse>
      items={asns}
      window={window}
      hasActiveSearch={hasActiveSearch}
      trackedCount={trackedAsns}
      isLoading={isLoading}
      getKey={asnListKey}
      renderHeader={(asn) => <AsnMetricsCardHeader asn={asn} />}
      chartDef={(asn) => asnPlayersChart(asn.asn, asn.asnOrg)}
      timeseriesOptions={(asn, timeWindow) =>
        toVisibleTimeseriesOptions(
          asnTimeseriesQueryOptions(asn.asn, asn.asnOrg, timeWindow) as {
            queryKey: readonly unknown[];
            queryFn?: (context: never) => AsnTimeseriesResponse | Promise<AsnTimeseriesResponse>;
            enabled?: boolean;
          },
        )
      }
      timeseriesEnabled={(asn) => asn.asn.length > 0}
      section={{
        title: "Per ASN",
        subtitleDefault: "Player history grouped by network",
        subtitleSearch: (shown, total) =>
          `Showing ${shown} of ${total} networks`,
        emptyTracked: "No networks are being tracked yet.",
        emptySearch: "No networks match your search.",
        emptySearchHint: "Try a different ASN or network name.",
      }}
    />
  );
}
