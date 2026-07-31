import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  ASN_SORT_FIELD_OPTIONS,
  getAsnSortFieldOption,
} from "@/lib/api/asn-sort";
import type { AsnSort, AsnSortField } from "@/lib/api/asn-sort";
import { toggleSortOrder } from "@/lib/api/server-sort";

type AsnSortToggleProps = {
  value: AsnSort;
  onValueChange: (value: AsnSort) => void;
  className?: string;
};

export function AsnSortToggle({
  value,
  onValueChange,
  className,
}: AsnSortToggleProps) {
  function handleFieldClick(field: AsnSortField) {
    if (field === value.field) {
      onValueChange({ field, order: toggleSortOrder(value.order) });
      return;
    }

    onValueChange({
      field,
      order: getAsnSortFieldOption(field).defaultOrder,
    });
  }

  return (
    <SegmentedControl
      value={value.field}
      onValueChange={handleFieldClick}
      aria-label="Sort networks"
      className={className}
      options={ASN_SORT_FIELD_OPTIONS.map((option) => {
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
