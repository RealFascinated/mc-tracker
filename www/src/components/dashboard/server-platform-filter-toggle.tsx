import { DashboardRangeToggle } from "@/components/dashboard/dashboard-range-toggle";
import type { DashboardRangeOption } from "@/components/dashboard/dashboard-range-toggle";
import { SERVER_PLATFORM_FILTER_OPTIONS } from "@/lib/api/platform";
import type { ServerPlatformFilter } from "@/lib/api/platform";

const SERVER_PLATFORM_FILTER_TOGGLE_OPTIONS: Array<
  DashboardRangeOption<ServerPlatformFilter>
> = SERVER_PLATFORM_FILTER_OPTIONS.map((option) => ({
  value: option.value,
  shortLabel: option.shortLabel,
  label: option.label,
}));

type ServerPlatformFilterToggleProps = {
  value: ServerPlatformFilter;
  onValueChange: (platform: ServerPlatformFilter) => void;
  className?: string;
};

export function ServerPlatformFilterToggle({
  value,
  onValueChange,
  className,
}: ServerPlatformFilterToggleProps) {
  return (
    <DashboardRangeToggle
      value={value}
      options={SERVER_PLATFORM_FILTER_TOGGLE_OPTIONS}
      onValueChange={onValueChange}
      aria-label="Server platform"
      className={className}
    />
  );
}
