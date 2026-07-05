import type { ServerListItem } from "@/lib/api/servers";
import type { TimeseriesSummaryResponse } from "@/lib/api/types";

export type CompareSortField =
  | "name"
  | "now"
  | "start"
  | "end"
  | "delta"
  | "changePct"
  | "avg";

export type CompareSortOrder = "asc" | "desc";

export type CompareSortRow = {
  server: ServerListItem | null;
  summary: TimeseriesSummaryResponse | null;
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
    sortValue: (row) => row.summary?.start ?? null,
  },
  {
    field: "end",
    label: "End",
    headerAlign: "right",
    defaultOrder: "desc",
    sortValue: (row) => row.summary?.end ?? null,
  },
  {
    field: "delta",
    label: "Δ",
    headerAlign: "right",
    defaultOrder: "desc",
    sortValue: (row) => {
      if (row.summary?.start == null || row.summary.end == null) {
        return null;
      }
      return row.summary.end - row.summary.start;
    },
  },
  {
    field: "changePct",
    label: "Change %",
    headerAlign: "right",
    defaultOrder: "desc",
    sortValue: (row) => row.summary?.changePct ?? null,
  },
  {
    field: "avg",
    label: "Avg",
    headerAlign: "right",
    defaultOrder: "desc",
    sortValue: (row) => row.summary?.avg ?? null,
  },
];

export function getCompareSortColumn(field: CompareSortField) {
  return (
    COMPARE_SORT_COLUMNS.find((column) => column.field === field) ??
    COMPARE_SORT_COLUMNS[1]
  );
}
