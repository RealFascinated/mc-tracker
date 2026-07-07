import type { ServerListItem } from "@/lib/api/servers";
import type { LaneStats } from "@/lib/compare/lane-stats";

export type CompareSortField =
  "name" | "now" | "start" | "end" | "delta" | "changePct" | "avg";

export type CompareSortOrder = "asc" | "desc";

export type CompareSortRow = {
  server: ServerListItem | null;
  stats: LaneStats | null;
};

export const COMPARE_SORT_COLUMNS: Array<{
  field: CompareSortField;
  label: string;
  headerAlign: "left" | "right";
  defaultOrder: CompareSortOrder;
  sortValue: (row: CompareSortRow) => number | string | null;
}> = [
  {
    field: "name",
    label: "Server",
    headerAlign: "left",
    defaultOrder: "asc",
    sortValue: (row) => row.server?.name ?? null,
  },
  {
    field: "now",
    label: "Now",
    headerAlign: "right",
    defaultOrder: "desc",
    sortValue: (row) => row.server?.playersOnline ?? null,
  },
  {
    field: "start",
    label: "Start",
    headerAlign: "right",
    defaultOrder: "desc",
    sortValue: (row) => row.stats?.start ?? null,
  },
  {
    field: "end",
    label: "End",
    headerAlign: "right",
    defaultOrder: "desc",
    sortValue: (row) => row.stats?.end ?? null,
  },
  {
    field: "delta",
    label: "Δ",
    headerAlign: "right",
    defaultOrder: "desc",
    sortValue: (row) => {
      if (row.stats?.start == null || row.stats.end == null) {
        return null;
      }
      return row.stats.end - row.stats.start;
    },
  },
  {
    field: "changePct",
    label: "Change %",
    headerAlign: "right",
    defaultOrder: "desc",
    sortValue: (row) => row.stats?.changePct ?? null,
  },
  {
    field: "avg",
    label: "Avg",
    headerAlign: "right",
    defaultOrder: "desc",
    sortValue: (row) => row.stats?.avg ?? null,
  },
];

export function getCompareSortColumn(field: CompareSortField) {
  return (
    COMPARE_SORT_COLUMNS.find((column) => column.field === field) ??
    COMPARE_SORT_COLUMNS[1]
  );
}
