import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, Header, SortingState } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminServer } from "@/lib/api/admin/servers";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type AdminServersTableProps = {
  servers: AdminServer[];
  onEdit: (server: AdminServer) => void;
  onPauseChange: (server: AdminServer, paused: boolean) => void;
  onDelete: (server: AdminServer) => void;
};

function formatServerType(type: string) {
  switch (type) {
    case "PC":
      return "Java (PC)";
    case "PE":
      return "Bedrock (PE)";
    default:
      return type;
  }
}

function SortableHeader({
  header,
  children,
}: {
  header: Header<AdminServer, unknown>;
  children: ReactNode;
}) {
  const canSort = header.column.getCanSort();
  const sorted = header.column.getIsSorted();

  if (!canSort) {
    return <span>{children}</span>;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 px-2 font-medium"
      onClick={header.column.getToggleSortingHandler()}
    >
      {children}
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}

export function AdminServersTable({
  servers,
  onEdit,
  onPauseChange,
  onDelete,
}: AdminServersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  const columns = useMemo<ColumnDef<AdminServer>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => formatServerType(row.original.type),
      },
      {
        accessorKey: "host",
        header: "Host",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.host}</span>
        ),
      },
      {
        accessorKey: "port",
        header: "Port",
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.port;
          const b = rowB.original.port;
          if (a == null && b == null) {
            return 0;
          }
          if (a == null) {
            return 1;
          }
          if (b == null) {
            return -1;
          }
          return a - b;
        },
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {row.original.port ?? "Default"}
          </span>
        ),
      },
      {
        accessorKey: "paused",
        header: "Status",
        sortingFn: (rowA, rowB) =>
          Number(rowA.original.paused) - Number(rowB.original.paused),
        cell: ({ row }) =>
          row.original.paused ? (
            <span className="text-muted-foreground">Paused</span>
          ) : (
            <span className="text-success">Active</span>
          ),
      },
      {
        accessorKey: "createdAt",
        header: "Added",
        sortingFn: (rowA, rowB) =>
          Date.parse(rowA.original.createdAt) -
          Date.parse(rowB.original.createdAt),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {dateFormatter.format(new Date(row.original.createdAt))}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8"
                  aria-label={`Actions for ${row.original.name}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(row.original)}>
                  <Pencil className="size-4" aria-hidden />
                  Edit server
                </DropdownMenuItem>
                {row.original.paused ? (
                  <DropdownMenuItem
                    onClick={() => onPauseChange(row.original, false)}
                  >
                    <Play className="size-4" aria-hidden />
                    Resume tracking
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onPauseChange(row.original, true)}
                  >
                    <Pause className="size-4" aria-hidden />
                    Pause tracking
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(row.original)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Delete server
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [onDelete, onEdit, onPauseChange],
  );

  const table = useReactTable({
    data: servers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={cn(
                  header.column.id === "actions" && "w-[1%] text-right",
                )}
              >
                {header.isPlaceholder ? null : (
                  <SortableHeader header={header}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </SortableHeader>
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length > 0 ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(cell.column.id === "actions" && "text-right")}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center text-muted-foreground"
            >
              No servers yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
