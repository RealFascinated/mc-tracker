import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  getServerSortFieldOption,
  SERVER_SORT_FIELD_OPTIONS,
  toggleSortOrder,
} from "@/lib/api/server-sort";
import type { ServerSort, ServerSortField } from "@/lib/api/server-sort";

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

    onValueChange({
      field,
      order: getServerSortFieldOption(field).defaultOrder,
    });
  }

  return (
    <SegmentedControl
      value={value.field}
      onValueChange={handleFieldClick}
      aria-label="Sort servers"
      className={className}
      options={SERVER_SORT_FIELD_OPTIONS.map((option) => {
        const active = value.field === option.field;
        return {
          value: option.field,
          shortLabel: option.label,
          label: option.label,
          icon: option.icon,
          activeIcon: option.directionIcons[value.order],
          hideLabelOnMobile: true,
          ariaLabel: active
            ? `${option.label}, ${value.order === "asc" ? "ascending" : "descending"}`
            : option.label,
        };
      })}
    />
  );
}
