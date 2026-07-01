import { ChevronDown, RefreshCw, Timer } from "lucide-react";

import { DashboardTimeRangePicker } from "@/components/dashboard/dashboard-time-range-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboardRefresh } from "@/lib/dashboard/use-dashboard-refresh";
import { DASHBOARD_REFRESH_INTERVAL_OPTIONS } from "@/lib/dashboard/refresh-interval";
import type { MetricTimeRange } from "@/lib/metrics/range";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { cn } from "@/lib/utils";

type DashboardTimeControlsProps = {
  window: MetricTimeWindow;
  onPresetChange: (range: MetricTimeRange) => void;
  onCustomChange: (from: number, to: number) => void;
  className?: string;
};

export function DashboardTimeControls({
  window,
  onPresetChange,
  onCustomChange,
  className,
}: DashboardTimeControlsProps) {
  const { refreshInterval, setRefreshInterval, refreshAll, isRefreshing } =
    useDashboardRefresh();

  const refreshIntervalLabel =
    DASHBOARD_REFRESH_INTERVAL_OPTIONS.find(
      (option) => option.value === refreshInterval,
    )?.shortLabel ?? "30s";

  return (
    <div className={cn("dashboard-time-controls", className)}>
      <DashboardTimeRangePicker
        window={window}
        onPresetChange={onPresetChange}
        onCustomChange={onCustomChange}
      />

      <div className="dashboard-time-controls-divider" aria-hidden />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="dashboard-time-controls-segment dashboard-time-controls-segment--refresh"
            aria-label="Auto-refresh interval"
          >
            <Timer className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{refreshIntervalLabel}</span>
            <ChevronDown className="size-3 shrink-0 opacity-70" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={refreshInterval}
            onValueChange={(value) =>
              setRefreshInterval(value as typeof refreshInterval)
            }
          >
            {DASHBOARD_REFRESH_INTERVAL_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="dashboard-time-controls-divider" aria-hidden />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="dashboard-time-controls-segment dashboard-time-controls-segment--manual"
            aria-label="Refresh now"
            disabled={isRefreshing}
            onClick={() => void refreshAll()}
          >
            <RefreshCw
              className={cn("size-3.5", isRefreshing && "animate-spin")}
              aria-hidden
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Refresh now</TooltipContent>
      </Tooltip>
    </div>
  );
}
