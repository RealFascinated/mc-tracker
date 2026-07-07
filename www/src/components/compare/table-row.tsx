import { Loader2, X } from "lucide-react";

import { ServerFavicon } from "@/components/dashboard/server/favicon";
import { ServerPlatformBadge } from "@/components/dashboard/server/platform-badge";
import { TableCell, TableRow } from "@/components/ui/table";
import type { PartialError } from "@/lib/api/types";
import type { ServerListItem } from "@/lib/api/servers";
import type { LaneStats } from "@/lib/compare/lane-stats";
import {
  formatDecimal,
  formatPercentValue,
  formatPlayers,
} from "@/lib/formatter";

function formatDelta(start: number | null, end: number | null): string {
  if (start == null || end == null) {
    return "—";
  }
  const delta = end - start;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatDecimal(delta, 0)}`;
}

function CompareStatCell({ value }: { value: string }) {
  return <span className="tabular-nums">{value}</span>;
}

export type CompareTableRowData = {
  id: string;
  server: ServerListItem | null;
  stats: LaneStats | null;
  error: PartialError | null;
  loading: boolean;
};

type CompareServerTableRowProps = {
  row: CompareTableRowData;
  minCompareServers: number;
  selectedCount: number;
  onRemove: (serverId: string) => void;
};

export function CompareServerTableRow({
  row,
  minCompareServers,
  selectedCount,
  onRemove,
}: CompareServerTableRowProps) {
  if (row.error) {
    return (
      <TableRow className="text-muted-foreground">
        <TableCell>
          <span className="font-mono text-xs">{row.id}</span>
        </TableCell>
        <TableCell colSpan={6}>{row.error.message}</TableCell>
        <TableCell>
          <button
            type="button"
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
            aria-label="Remove server"
            onClick={() => onRemove(row.id)}
          >
            <X className="size-4" />
          </button>
        </TableCell>
      </TableRow>
    );
  }

  const server = row.server;
  const showLoading = row.loading && selectedCount >= minCompareServers;

  return (
    <TableRow>
      <TableCell>
        {row.loading && !server ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            <span>Loading…</span>
          </div>
        ) : server ? (
          <div className="flex min-w-0 items-center gap-2">
            <ServerFavicon
              name={server.name}
              favicon={server.favicon}
              size="sm"
            />
            <div className="min-w-0">
              <div className="truncate font-medium">{server.name}</div>
              <ServerPlatformBadge platform={server.type} />
            </div>
          </div>
        ) : (
          <span className="font-mono text-xs">{row.id}</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <CompareStatCell value={formatPlayers(server?.playersOnline ?? null)} />
      </TableCell>
      <TableCell className="text-right">
        {showLoading ? (
          <CompareStatCell value="…" />
        ) : (
          <CompareStatCell value={formatPlayers(row.stats?.start ?? null)} />
        )}
      </TableCell>
      <TableCell className="text-right">
        {showLoading ? (
          <CompareStatCell value="…" />
        ) : (
          <CompareStatCell value={formatPlayers(row.stats?.end ?? null)} />
        )}
      </TableCell>
      <TableCell className="text-right">
        {showLoading ? (
          <CompareStatCell value="…" />
        ) : (
          <CompareStatCell
            value={formatDelta(
              row.stats?.start ?? null,
              row.stats?.end ?? null,
            )}
          />
        )}
      </TableCell>
      <TableCell className="text-right">
        {showLoading ? (
          <CompareStatCell value="…" />
        ) : (
          <CompareStatCell
            value={
              row.stats?.changePct == null
                ? "—"
                : formatPercentValue(row.stats.changePct)
            }
          />
        )}
      </TableCell>
      <TableCell className="text-right">
        {showLoading ? (
          <CompareStatCell value="…" />
        ) : (
          <CompareStatCell value={formatPlayers(row.stats?.avg ?? null)} />
        )}
      </TableCell>
      <TableCell>
        <button
          type="button"
          className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
          aria-label="Remove server"
          onClick={() => onRemove(row.id)}
        >
          <X className="size-4" />
        </button>
      </TableCell>
    </TableRow>
  );
}
