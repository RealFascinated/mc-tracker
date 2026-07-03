import { ArrowDown, ArrowUp, Type, Users } from "lucide-react";

import {
  defaultOrderForField,
  SERVER_SORT_FIELD_OPTIONS,
  toggleSortOrder,
} from "@/lib/api/server-sort";
import type { ServerSort, ServerSortField } from "@/lib/api/server-sort";
import { cn } from "cnfast";

const SORT_FIELD_ICONS: Record<ServerSortField, typeof Users> = {
  players: Users,
  name: Type,
};

type ServerSortToggleProps = {
  value: ServerSort;
  onValueChange: (value: ServerSort) => void;
  className?: string;
};

export function ServerSortToggle({
  value,
  onValueChange,
  className,
}: ServerSortToggleProps) {
  function handleFieldClick(field: ServerSortField) {
    if (field === value.field) {
      onValueChange({ field, order: toggleSortOrder(value.order) });
      return;
    }

    onValueChange({ field, order: defaultOrderForField(field) });
  }

  return (
    <div
      className={cn("inline-flex flex-wrap items-center gap-1", className)}
      role="group"
      aria-label="Sort servers"
    >
      {SERVER_SORT_FIELD_OPTIONS.map((option) => {
        const active = value.field === option.field;
        const Icon = SORT_FIELD_ICONS[option.field];
        const DirectionIcon = value.order === "asc" ? ArrowUp : ArrowDown;

        return (
          <button
            key={option.field}
            type="button"
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-snug border px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-monitor dark:focus-visible:ring-warning",
              active
                ? "border-monitor text-monitor dark:border-warning dark:text-warning"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
            aria-label={
              active
                ? `${option.label}, ${value.order === "asc" ? "ascending" : "descending"}`
                : option.label
            }
            onClick={() => handleFieldClick(option.field)}
          >
            {active ? (
              <DirectionIcon className="size-3 shrink-0" aria-hidden />
            ) : (
              <Icon className="size-3 shrink-0 opacity-70" aria-hidden />
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
