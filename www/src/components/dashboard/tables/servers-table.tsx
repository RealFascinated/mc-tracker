import { memo, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "cnfast";

import { ServerFavicon } from "@/components/dashboard/server/favicon";
import { ServerPlatformBadge } from "@/components/dashboard/server/platform-badge";
import { ServerHostCopy } from "@/components/dashboard/server/host-copy";
import { AsnHoverPreview } from "@/components/dashboard/server/asn-hover-preview";
import { ServerPinButton } from "@/components/dashboard/server/pin-button";
import { ServerStatusDot } from "@/components/dashboard/server/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ServerListItem } from "@/lib/api/servers";
import { asnLabelOptional } from "@/lib/api/asns";
import { formatPercentValue, formatPlayers, peakTimestampTooltip } from "@/lib/formatter";


type SortField = "name" | "players" | "peak24h" | "peakAllTime" | "trend24h" | "trend7d" | "trend30d";
type SortDirection = "asc" | "desc";

type ServersTableProps = {
  servers: ServerListItem[];
  pinnedServerIds?: ReadonlySet<string>;
  showPinButtons?: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
};

const SORTABLE_COLUMNS: Array<{
  field: SortField;
  label: string;
  className?: string;
}> = [
  { field: "name", label: "Server" },
  { field: "players", label: "Now", className: "text-right" },
  { field: "trend24h", label: "24h", className: "text-right" },
  { field: "trend7d", label: "7d", className: "text-right" },
  { field: "trend30d", label: "30d", className: "text-right" },
  { field: "peak24h", label: "Peak 24h", className: "text-right" },
  { field: "peakAllTime", label: "All-time Peak", className: "text-right" },
];

function SortIcon({
  field,
  currentField,
  direction,
}: {
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
}) {
  if (field !== currentField) {
    return (
      <ArrowUpDown className="ml-1 size-3 shrink-0 opacity-30" aria-hidden />
    );
  }
  return direction === "asc" ? (
    <ArrowUp className="ml-1 size-3 shrink-0" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 size-3 shrink-0" aria-hidden />
  );
}

function sortServersList(
  servers: ServerListItem[],
  field: SortField,
  direction: SortDirection,
): ServerListItem[] {
  const sorted = [...servers];
  sorted.sort((a, b) => {
    let cmp: number;
    switch (field) {
      case "name":
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        break;
      case "players":
        cmp = (a.playersOnline ?? -1) - (b.playersOnline ?? -1);
        break;
      case "trend24h":
        cmp = (a.trend24h ?? 0) - (b.trend24h ?? 0);
        break;
      case "trend7d":
        cmp = (a.trend7d ?? 0) - (b.trend7d ?? 0);
        break;
      case "trend30d":
        cmp = (a.trend30d ?? 0) - (b.trend30d ?? 0);
        break;
      case "peak24h":
        cmp = (a.peaks.players24h ?? -1) - (b.peaks.players24h ?? -1);
        break;
      case "peakAllTime":
        cmp =
          (a.peaks.allTime?.players ?? -1) -
          (b.peaks.allTime?.players ?? -1);
        break;
    }
    return direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}

function serverFieldsEqual(a: ServerListItem, b: ServerListItem): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.type === b.type &&
    a.host === b.host &&
    a.port === b.port &&
    a.asn === b.asn &&
    a.asnOrg === b.asnOrg &&
    a.playersOnline === b.playersOnline &&
    a.status === b.status &&
    a.favicon === b.favicon &&
    a.trend24h === b.trend24h &&
    a.trend7d === b.trend7d &&
    a.trend30d === b.trend30d &&
    a.peaks.players24h === b.peaks.players24h &&
    a.peaks.allTime?.players === b.peaks.allTime?.players &&
    a.peaks.allTime?.timestamp === b.peaks.allTime?.timestamp
  );
}

type ServerTableRowProps = {
  server: ServerListItem;
  isPinned: boolean;
  showPinButtons: boolean;
};

function ServerTableRow({ server, isPinned, showPinButtons }: ServerTableRowProps) {
  return (
    <tr className="group border-b border-border transition-colors hover:bg-muted/30 last:border-b-0">
      {/* Server name column */}
      <TableCell>
        <div className="flex items-center gap-2.5">
          <ServerFavicon
            name={server.name}
            favicon={server.favicon}
            size="sm"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ServerStatusDot status={server.status} className="mt-px" />
              <Link
                to="/servers/$serverId"
                params={{ serverId: server.id }}
                className="truncate text-sm font-medium text-foreground transition-colors hover:text-monitor dark:hover:text-warning"
              >
                {server.name}
              </Link>
              <ServerPlatformBadge platform={server.type} />
            </div>
            <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              <ServerHostCopy
                host={server.host}
                port={server.port}
                className="shrink-0 whitespace-nowrap hover:text-foreground"
              />
              {(() => {
                const asnName = asnLabelOptional(server);
                return asnName ? (
                  <>
                    <span aria-hidden="true">·</span>
                    {server.asn ? (
                      <AsnHoverPreview
                        asn={server.asn}
                        asnOrg={server.asnOrg}
                        label={asnName}
                        className="truncate hover:text-foreground"
                      />
                    ) : (
                      <span className="truncate">{asnName}</span>
                    )}
                  </>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </TableCell>

      {/* Players online */}
      <TableCell className="text-right tabular-nums">
        <span className="text-sm font-medium text-foreground">
          {formatPlayers(server.playersOnline)}
        </span>
      </TableCell>

      {/* Trend 24h */}
      <TableCell className="text-right tabular-nums">
        <TrendCell value={server.trend24h} />
      </TableCell>

      {/* Trend 7d */}
      <TableCell className="text-right tabular-nums">
        <TrendCell value={server.trend7d} />
      </TableCell>

      {/* Trend 30d */}
      <TableCell className="text-right tabular-nums">
        <TrendCell value={server.trend30d} />
      </TableCell>

      {/* Peak 24h */}
      <TableCell className="text-right tabular-nums">
        <span className="text-sm text-muted-foreground">
          {formatPlayers(server.peaks.players24h)}
        </span>
      </TableCell>

      {/* All-time peak */}
      <TableCell className="text-right tabular-nums">
        <span
          className="text-sm text-muted-foreground"
          title={peakTimestampTooltip(server.peaks.allTime?.timestamp)}
        >
          {formatPlayers(server.peaks.allTime?.players ?? null)}
        </span>
      </TableCell>

      {/* Pin button */}
      {showPinButtons && (
        <TableCell className="w-10">
          <ServerPinButton serverId={server.id} isPinned={isPinned} />
        </TableCell>
      )}
    </tr>
  );
}

const ServerTableRowMemo = memo(ServerTableRow, (prev, next) =>
  prev.showPinButtons === next.showPinButtons &&
  prev.isPinned === next.isPinned &&
  serverFieldsEqual(prev.server, next.server),
);

function ServersTable({
  servers,
  pinnedServerIds,
  showPinButtons = false,
  sortField,
  sortDirection,
  onSort,
}: ServersTableProps) {
  const sorted = useMemo(
    () => sortServersList(servers, sortField, sortDirection),
    [servers, sortField, sortDirection],
  );

  return (
    <div className="rounded-soft border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            {SORTABLE_COLUMNS.map((col) => (
              <TableHead
                key={col.field}
                className={cn(
                  "cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground",
                  col.className,
                )}
                onClick={() => onSort(col.field)}
                aria-sort={
                  col.field === sortField
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                <span className="inline-flex items-center">
                  {col.label}
                  <SortIcon
                    field={col.field}
                    currentField={sortField}
                    direction={sortDirection}
                  />
                </span>
              </TableHead>
            ))}
            {showPinButtons && (
              <TableHead className="w-10" aria-label="Pin" />
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((server) => (
            <ServerTableRowMemo
              key={server.id}
              server={server}
              isPinned={pinnedServerIds?.has(server.id) ?? false}
              showPinButtons={showPinButtons}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TrendCell({ value }: { value: number | null | undefined }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.05;

  return (
    <span
      className={cn(
        "text-sm font-medium tabular-nums",
        isNeutral && "text-muted-foreground",
        isPositive && "text-green-600 dark:text-green-400",
        !isPositive && !isNeutral && "text-red-600 dark:text-red-400",
      )}
    >
      {isPositive ? "+" : ""}
      {formatPercentValue(value, 1)}
    </span>
  );
}

export { ServersTable, sortServersList };
export type { SortField, SortDirection };
