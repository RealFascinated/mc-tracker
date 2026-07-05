import { DashboardRangeToggle } from "@/components/dashboard/controls/range-toggle";
import { SERVER_PLATFORM_FILTER_OPTIONS } from "@/lib/api/platform";
import type { ServerPlatformFilter } from "@/lib/api/platform";

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
      options={SERVER_PLATFORM_FILTER_OPTIONS}
      onValueChange={onValueChange}
      aria-label="Server platform"
      className={className}
    />
  );
}
