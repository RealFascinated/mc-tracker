import { DashboardRangeToggle } from "@/components/dashboard/dashboard-card";
import type { DashboardRangeOption } from "@/components/dashboard/dashboard-card";

export type DashboardView = "server" | "asn";

const DASHBOARD_VIEW_OPTIONS: Array<DashboardRangeOption<DashboardView>> = [
  { value: "server", shortLabel: "Per server", label: "Per server" },
  { value: "asn", shortLabel: "Per ASN", label: "Per ASN" },
];

type DashboardViewToggleProps = {
  value: DashboardView;
  onValueChange: (value: DashboardView) => void;
};

export function DashboardViewToggle({
  value,
  onValueChange,
}: DashboardViewToggleProps) {
  return (
    <DashboardRangeToggle
      value={value}
      options={DASHBOARD_VIEW_OPTIONS}
      onValueChange={onValueChange}
      aria-label="Dashboard view"
    />
  );
}
