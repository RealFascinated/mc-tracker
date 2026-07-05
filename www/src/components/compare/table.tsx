import { useQueries } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CompareServerSearch } from "@/components/compare/search";
import { CompareServerTableRow } from "@/components/compare/table-row";
import { DashboardCard } from "@/components/dashboard/cards/card";
import { DashboardCardHeader } from "@/components/dashboard/cards/card-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ServersCompareResponse } from "@/lib/api/compare";
import type { ServerListItem, ServerSearchItem } from "@/lib/api/servers";
import { serverQueryOptions } from "@/lib/api/servers.queries";
import type { PartialError, TimeseriesSummaryResponse } from "@/lib/api/types";
import {
  COMPARE_SORT_COLUMNS,
  getCompareSortColumn,
  type CompareSortField,
  type CompareSortOrder,
} from "@/lib/compare/sort";
import { MAX_COMPARE_SERVERS, MIN_COMPARE_SERVERS } from "@/lib/compare/ids";

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

async function copyCompareLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Compare link copied");
  } catch {
    toast.error("Could not copy link");
  }
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
  const [sortField, setSortField] = useState<CompareSortField>("now");
  const [sortOrder, setSortOrder] = useState<CompareSortOrder>("desc");

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
    const column = getCompareSortColumn(sortField);
    const direction = sortOrder === "asc" ? 1 : -1;
    const copy = [...rows];

    copy.sort((left, right) => {
      const a = column.sortValue(left);
      const b = column.sortValue(right);
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      if (typeof a === "string" && typeof b === "string") {
        return a.localeCompare(b) * direction;
      }
      return ((a as number) - (b as number)) * direction;
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

  const toggleSort = (field: CompareSortField) => {
    if (sortField === field) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortOrder(getCompareSortColumn(field).defaultOrder);
  };

  const sortIndicator = (field: CompareSortField) => {
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
            onClick={() => void copyCompareLink()}
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
                {COMPARE_SORT_COLUMNS.map((column) => (
                  <TableHead
                    key={column.field}
                    className={
                      column.headerAlign === "right" ? "text-right" : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.field)}
                    >
                      {column.label}
                      {sortIndicator(column.field)}
                    </button>
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <CompareServerTableRow
                  key={row.id}
                  row={row}
                  minCompareServers={MIN_COMPARE_SERVERS}
                  selectedCount={ids.length}
                  onRemove={removeServer}
                />
              ))}
            </TableBody>
          </Table>
        ) : null}
      </div>
    </DashboardCard>
  );
}
