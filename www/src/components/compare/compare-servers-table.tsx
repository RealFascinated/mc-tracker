import { useQueries } from "@tanstack/react-query";
import { Link2, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CompareServerSearch } from "@/components/compare/compare-server-search";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardCardHeader } from "@/components/dashboard/dashboard-card-header";
import { ServerFavicon } from "@/components/dashboard/server-favicon";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ServersCompareResponse } from "@/lib/api/compare";
import type { ServerListItem, ServerSearchItem } from "@/lib/api/servers";
import { serverQueryOptions } from "@/lib/api/servers.queries";
import type { PartialError, TimeseriesSummaryResponse } from "@/lib/api/types";
import {
  formatServerPlatformLabel,
  serverPlatformBadgeClassName,
} from "@/lib/api/platform";
import { MAX_COMPARE_SERVERS, MIN_COMPARE_SERVERS } from "@/lib/compare/ids";
import {
  formatDecimal,
  formatPercentValue,
  formatPlayers,
} from "@/lib/formatter";

type SortField =
  "name" | "now" | "start" | "end" | "delta" | "changePct" | "avg";

type SortOrder = "asc" | "desc";

type CompareRow = {
  id: string;
  server: ServerListItem | null;
  summary: TimeseriesSummaryResponse | null;
  error: PartialError | null;
  loading: boolean;
};

type CompareServersTableProps = {
  ids: string[];
  onIdsChange: (ids: string[]) => void;
  compareData?: ServersCompareResponse;
  compareLoading?: boolean;
};

function formatDelta(start: number | null, end: number | null): string {
  if (start == null || end == null) {
    return "—";
  }
  const delta = end - start;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatDecimal(delta, 0)}`;
}

function errorForServer(
  errors: PartialError[],
  id: string,
): PartialError | null {
  return (
    errors.find(
      (entry) => entry.target.kind === "server" && entry.target.id === id,
    ) ?? null
  );
}

export function CompareServersTable({
  ids,
  onIdsChange,
  compareData,
  compareLoading = false,
}: CompareServersTableProps) {
  const [sortField, setSortField] = useState<SortField>("now");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const selectedIds = new Set(ids);
  const atCapacity = ids.length >= MAX_COMPARE_SERVERS;

  const serverQueries = useQueries({
    queries: ids.map((id) => serverQueryOptions(id)),
  });

  const rows = useMemo((): CompareRow[] => {
    return ids.map((id, index) => {
      const compareItem = compareData?.servers.find(
        (item) => item.server.id === id,
      );
      const error = compareData ? errorForServer(compareData.errors, id) : null;
      const detailQuery = serverQueries[index];

      return {
        id,
        server: compareItem?.server ?? detailQuery.data ?? null,
        summary: compareItem?.summary ?? null,
        error,
        loading:
          (detailQuery.isPending && !compareItem?.server) ||
          (compareLoading && !compareItem && !error),
      };
    });
  }, [compareData, compareLoading, ids, serverQueries]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    const direction = sortOrder === "asc" ? 1 : -1;

    copy.sort((left, right) => {
      const compare = (
        a: number | string | null,
        b: number | string | null,
      ) => {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        if (typeof a === "string" && typeof b === "string") {
          return a.localeCompare(b) * direction;
        }
        return ((a as number) - (b as number)) * direction;
      };

      switch (sortField) {
        case "name":
          return compare(left.server?.name ?? null, right.server?.name ?? null);
        case "now":
          return compare(
            left.server?.playersOnline ?? null,
            right.server?.playersOnline ?? null,
          );
        case "start":
          return compare(
            left.summary?.start ?? null,
            right.summary?.start ?? null,
          );
        case "end":
          return compare(left.summary?.end ?? null, right.summary?.end ?? null);
        case "delta": {
          const leftDelta =
            left.summary?.start != null && left.summary.end != null
              ? left.summary.end - left.summary.start
              : null;
          const rightDelta =
            right.summary?.start != null && right.summary.end != null
              ? right.summary.end - right.summary.start
              : null;
          return compare(leftDelta, rightDelta);
        }
        case "changePct":
          return compare(
            left.summary?.changePct ?? null,
            right.summary?.changePct ?? null,
          );
        case "avg":
          return compare(left.summary?.avg ?? null, right.summary?.avg ?? null);
        default:
          return 0;
      }
    });

    return copy;
  }, [rows, sortField, sortOrder]);

  const addServer = (server: ServerSearchItem) => {
    if (selectedIds.has(server.id) || ids.length >= MAX_COMPARE_SERVERS) {
      return;
    }
    onIdsChange([...ids, server.id]);
  };

  const removeServer = (serverId: string) => {
    onIdsChange(ids.filter((id) => id !== serverId));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Compare link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortOrder(field === "name" ? "asc" : "desc");
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  const subtitle =
    ids.length === 0
      ? `Add ${MIN_COMPARE_SERVERS}–${MAX_COMPARE_SERVERS} servers to compare.`
      : ids.length < MIN_COMPARE_SERVERS
        ? `Add ${MIN_COMPARE_SERVERS - ids.length} more to compare.`
        : `${ids.length} of ${MAX_COMPARE_SERVERS} servers selected`;

  const statCell = (value: string) => (
    <span className="tabular-nums">{value}</span>
  );

  return (
    <DashboardCard className="overflow-visible">
      <DashboardCardHeader
        title="Servers to compare"
        subtitle={subtitle}
        trailingAction={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyLink()}
            disabled={ids.length < MIN_COMPARE_SERVERS}
          >
            <Link2 className="size-3.5" aria-hidden />
            Copy link
          </Button>
        }
      />
      <div className="space-y-4 p-4">
        <div className="relative z-20">
          <CompareServerSearch
            selectedIds={selectedIds}
            onAdd={addServer}
            disabled={atCapacity}
          />
        </div>

        {ids.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" onClick={() => toggleSort("name")}>
                    Server{sortIndicator("name")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" onClick={() => toggleSort("now")}>
                    Now{sortIndicator("now")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" onClick={() => toggleSort("start")}>
                    Start{sortIndicator("start")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" onClick={() => toggleSort("end")}>
                    End{sortIndicator("end")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" onClick={() => toggleSort("delta")}>
                    Δ{sortIndicator("delta")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" onClick={() => toggleSort("changePct")}>
                    Change %{sortIndicator("changePct")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" onClick={() => toggleSort("avg")}>
                    Avg{sortIndicator("avg")}
                  </button>
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => {
                if (row.error) {
                  return (
                    <TableRow key={row.id} className="text-muted-foreground">
                      <TableCell>
                        <span className="font-mono text-xs">{row.id}</span>
                      </TableCell>
                      <TableCell colSpan={6}>{row.error.message}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                          aria-label="Remove server"
                          onClick={() => removeServer(row.id)}
                        >
                          <X className="size-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                }

                const server = row.server;

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.loading && !server ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden
                          />
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
                            <div className="truncate font-medium">
                              {server.name}
                            </div>
                            <span
                              className={serverPlatformBadgeClassName(
                                server.type,
                              )}
                            >
                              {formatServerPlatformLabel(server.type)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono text-xs">{row.id}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {statCell(formatPlayers(server?.playersOnline ?? null))}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.loading && ids.length >= MIN_COMPARE_SERVERS
                        ? statCell("…")
                        : statCell(formatPlayers(row.summary?.start ?? null))}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.loading && ids.length >= MIN_COMPARE_SERVERS
                        ? statCell("…")
                        : statCell(formatPlayers(row.summary?.end ?? null))}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.loading && ids.length >= MIN_COMPARE_SERVERS
                        ? statCell("…")
                        : statCell(
                            formatDelta(
                              row.summary?.start ?? null,
                              row.summary?.end ?? null,
                            ),
                          )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.loading && ids.length >= MIN_COMPARE_SERVERS
                        ? statCell("…")
                        : statCell(
                            row.summary?.changePct == null
                              ? "—"
                              : formatPercentValue(row.summary.changePct),
                          )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.loading && ids.length >= MIN_COMPARE_SERVERS
                        ? statCell("…")
                        : statCell(formatPlayers(row.summary?.avg ?? null))}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                        aria-label="Remove server"
                        onClick={() => removeServer(row.id)}
                      >
                        <X className="size-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </div>
    </DashboardCard>
  );
}
