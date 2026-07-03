export const SERVER_SORT_STORAGE_KEY = "mc-tracker-server-sort";

export type ServerSortField = "players" | "name";

export type SortOrder = "asc" | "desc";

export type ServerSort = {
  field: ServerSortField;
  order: SortOrder;
};

export const DEFAULT_SERVER_SORT: ServerSort = {
  field: "players",
  order: "desc",
};

export const SERVER_SORT_FIELD_OPTIONS: Array<{
  field: ServerSortField;
  label: string;
}> = [
  { field: "players", label: "Players" },
  { field: "name", label: "Name" },
];

export function defaultOrderForField(field: ServerSortField): SortOrder {
  return field === "players" ? "desc" : "asc";
}

export function toggleSortOrder(order: SortOrder): SortOrder {
  return order === "asc" ? "desc" : "asc";
}

export function parseStoredServerSort(raw: unknown): ServerSort | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const value = raw as { field?: unknown; order?: unknown };
  if (
    (value.field === "players" || value.field === "name") &&
    (value.order === "asc" || value.order === "desc")
  ) {
    return { field: value.field, order: value.order };
  }

  return null;
}

export function parseServerSortFieldParam(
  value: unknown,
): ServerSortField | undefined {
  if (value === "players" || value === "name") {
    return value;
  }
  return undefined;
}

export function parseSortOrderParam(value: unknown): SortOrder | undefined {
  if (value === "asc" || value === "desc") {
    return value;
  }
  return undefined;
}

export function resolveServerSort(search: {
  sort?: ServerSortField;
  order?: SortOrder;
}): ServerSort {
  const field = search.sort ?? DEFAULT_SERVER_SORT.field;
  const order = search.order ?? defaultOrderForField(field);
  return { field, order };
}

export function serverSortToSearchParams(
  sort: ServerSort,
): { sort?: ServerSortField; order?: SortOrder } {
  const params: { sort?: ServerSortField; order?: SortOrder } = {};
  if (sort.field !== DEFAULT_SERVER_SORT.field) {
    params.sort = sort.field;
  }
  if (sort.order !== defaultOrderForField(sort.field)) {
    params.order = sort.order;
  }
  return params;
}

export function sortServersBy<
  T extends { id: string; name: string; playersOnline: number | null },
>(servers: T[], sort: ServerSort): T[] {
  const sorted = [...servers];
  if (sort.field === "name") {
    sorted.sort((left, right) => {
      const cmp =
        left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
        left.id.localeCompare(right.id);
      return sort.order === "asc" ? cmp : -cmp;
    });
    return sorted;
  }

  sorted.sort((left, right) => {
    const leftPlayers = left.playersOnline ?? -1;
    const rightPlayers = right.playersOnline ?? -1;
    return sort.order === "asc"
      ? leftPlayers - rightPlayers
      : rightPlayers - leftPlayers;
  });
  return sorted;
}
