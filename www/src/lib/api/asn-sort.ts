import { ArrowDown, ArrowUp, Landmark, Server, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AsnListItem } from "@/lib/api/asns";
import type { SortOrder } from "@/lib/api/server-sort";

export type AsnSortField = "players" | "servers" | "name";

export type AsnSort = {
  field: AsnSortField;
  order: SortOrder;
};

export const DEFAULT_ASN_SORT: AsnSort = {
  field: "players",
  order: "desc",
};

export const ASN_SORT_FIELD_OPTIONS: Array<{
  field: AsnSortField;
  label: string;
  defaultOrder: SortOrder;
  icon: LucideIcon;
  directionIcons: { asc: LucideIcon; desc: LucideIcon };
}> = [
  {
    field: "players",
    label: "Players",
    defaultOrder: "desc",
    icon: Users,
    directionIcons: { asc: ArrowUp, desc: ArrowDown },
  },
  {
    field: "servers",
    label: "Servers",
    defaultOrder: "desc",
    icon: Server,
    directionIcons: { asc: ArrowUp, desc: ArrowDown },
  },
  {
    field: "name",
    label: "Name",
    defaultOrder: "asc",
    icon: Landmark,
    directionIcons: { asc: ArrowUp, desc: ArrowDown },
  },
];

export function getAsnSortFieldOption(
  field: AsnSortField,
): (typeof ASN_SORT_FIELD_OPTIONS)[number] {
  return (
    ASN_SORT_FIELD_OPTIONS.find((option) => option.field === field) ??
    ASN_SORT_FIELD_OPTIONS[0]
  );
}

export function parseAsnSortFieldParam(
  value: unknown,
): AsnSortField | undefined {
  if (value === "players" || value === "servers" || value === "name") {
    return value;
  }
  return undefined;
}

export function resolveAsnSort(search: {
  sort?: AsnSortField;
  order?: SortOrder;
}): AsnSort {
  const field = search.sort ?? DEFAULT_ASN_SORT.field;
  const order = search.order ?? getAsnSortFieldOption(field).defaultOrder;
  return { field, order };
}

export function asnSortToSearchParams(sort: AsnSort): {
  sort?: AsnSortField;
  order?: SortOrder;
} {
  const params: { sort?: AsnSortField; order?: SortOrder } = {};
  if (sort.field !== DEFAULT_ASN_SORT.field) {
    params.sort = sort.field;
  }
  if (sort.order !== getAsnSortFieldOption(sort.field).defaultOrder) {
    params.order = sort.order;
  }
  return params;
}

export function sortAsnsBy(asns: AsnListItem[], sort: AsnSort): AsnListItem[] {
  const sorted = [...asns];
  sorted.sort((left, right) => {
    let cmp: number;
    switch (sort.field) {
      case "name":
        cmp =
          left.asnOrg.localeCompare(right.asnOrg, undefined, {
            sensitivity: "base",
          }) ||
          left.asn.localeCompare(right.asn, undefined, {
            sensitivity: "base",
          });
        break;
      case "servers":
        cmp = left.serverCount - right.serverCount;
        break;
      case "players":
        cmp = left.playersOnline - right.playersOnline;
        break;
    }
    return sort.order === "asc" ? cmp : -cmp;
  });
  return sorted;
}
