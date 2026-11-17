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
import {
  formatPercentValue,
  formatPlayers,
  peakTimestampTooltip,
} from "@/lib/formatter";

type SortField =
  | "name"
  | "players"
  | "peak24h"
  | "peakAllTime"
  | "trend24h"
  | "trend7d"
  | "trend30d";
type SortDirection = "asc" | "desc";

type ServersTableProps = {
  servers: ServerListItem[];
  pinnedServerIds?: ReadonlySet<string>;
  showPinButtons?: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  emptyMessage?: string;
};

const SORTABLE_COLUMNS: Array<{
  field: SortField;
  label: string;
  className?: string;
}> = [
  { field: "name", label: "Server" },
  { field: "players", label: "Now", className: "text-right" },
  { field: "trend24h", label: "24h", className: "text-right" },
  {
    field: "trend7d",
    label: "7d",
    className: "hidden text-right sm:table-cell",
  },
  {
    field: "trend30d",
    label: "30d",
    className: "hidden text-right sm:table-cell",
  },
  {
    field: "peak24h",
    label: "Peak 24h",
    className: "hidden text-right md:table-cell",
  },
  {
    field: "peakAllTime",
    label: "All-time Peak",
    className: "hidden text-right lg:table-cell",
  },
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
          (a.peaks.allTime?.players ?? -1) - (b.peaks.allTime?.players ?? -1);
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
  rank: number;
  maxPlayers: number;
  server: ServerListItem;
  isPinned: boolean;
  showPinButtons: boolean;
};

function ServerTableRow({
  rank,
  maxPlayers,
  server,
  isPinned,
  showPinButtons,
}: ServerTableRowProps) {
  return (
    <tr className="group border-b border-border transition-colors hover:bg-muted/40 last:border-b-0">
      <TableCell className="w-12 pr-0 text-right text-xs tabular-nums text-muted-foreground">
        {rank}
      </TableCell>
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
                className="truncate text-sm font-medium text-foreground transition-colors hover:text-monitor dark:hover:text-monitor"
              >
                {server.name}
              </Link>
              <ServerPlatformBadge platform={server.type} />
            </div>
            <div className="mt-0.5 flex max-w-[8.5rem] items-center gap-1 overflow-hidden font-mono text-[11px] text-muted-foreground sm:max-w-none">
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
      <TableCell className="text-right tabular-nums sm:w-56">
        <div className="flex items-center justify-end gap-3">
          <span
            className="players-bar"
            aria-hidden
            style={{
              ["--share" as string]: `${
                maxPlayers > 0
                  ? Math.max(
                      ((server.playersOnline ?? 0) / maxPlayers) * 100,
                      server.playersOnline ? 2 : 0,
                    )
                  : 0
              }%`,
            }}
          />
          <span className="w-16 text-sm font-medium text-foreground">
            {formatPlayers(server.playersOnline)}
          </span>
        </div>
      </TableCell>

      {/* Trend 24h */}
      <TableCell className="text-right tabular-nums">
        <TrendCell value={server.trend24h} />
      </TableCell>

      {/* Trend 7d */}
      <TableCell className="hidden sm:table-cell text-right tabular-nums">
        <TrendCell value={server.trend7d} />
      </TableCell>

      {/* Trend 30d */}
      <TableCell className="hidden sm:table-cell text-right tabular-nums">
        <TrendCell value={server.trend30d} />
      </TableCell>

      {/* Peak 24h */}
      <TableCell className="hidden md:table-cell text-right tabular-nums">
        <span className="text-sm text-muted-foreground">
          {formatPlayers(server.peaks.players24h)}
        </span>
      </TableCell>

      {/* All-time peak */}
      <TableCell className="hidden lg:table-cell text-right tabular-nums">
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

const ServerTableRowMemo = memo(
  ServerTableRow,
  (prev, next) =>
    prev.rank === next.rank &&
    prev.maxPlayers === next.maxPlayers &&
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
  emptyMessage = "No servers to show.",
}: ServersTableProps) {
  const sorted = useMemo(
    () => sortServersList(servers, sortField, sortDirection),
    [servers, sortField, sortDirection],
  );

  const maxPlayers = useMemo(
    () => servers.reduce((max, s) => Math.max(max, s.playersOnline ?? 0), 0),
    [servers],
  );

  return (
    <div className="servers-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 pr-0" aria-label="Rank" />
            {SORTABLE_COLUMNS.map((col) => (
              <TableHead
                key={col.field}
                className={cn(
                  "cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground",
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
            {showPinButtons && <TableHead className="w-10" aria-label="Pin" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={SORTABLE_COLUMNS.length + 1 + (showPinButtons ? 1 : 0)}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((server, index) => (
              <ServerTableRowMemo
                key={server.id}
                rank={index + 1}
                maxPlayers={maxPlayers}
                server={server}
                isPinned={pinnedServerIds?.has(server.id) ?? false}
                showPinButtons={showPinButtons}
              />
            ))
          )}
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
        isPositive && "text-platform-java",
        !isPositive && !isNeutral && "text-destructive",
      )}
    >
      {isPositive ? "+" : ""}
      {formatPercentValue(value, 1)}
    </span>
  );
}

export { ServersTable, sortServersList };
export type { SortField, SortDirection };
