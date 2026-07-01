import {
  SlidingSegmentedControl,
  SlidingSegmentedControlItem,
} from "@/components/ui/sliding-segmented-control";
import { cn } from "@/lib/utils";

export type DashboardRangeOption<T extends string> = {
  value: T;
  shortLabel: string;
  label?: string;
};

const dashboardRangeItemClassName =
  "relative z-10 h-7 min-w-0 rounded-snug px-2.5 text-center text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monitor dark:focus-visible:ring-warning";

const dashboardRangeItemFullWidthClassName = "flex-1 px-1.5";

const dashboardRangeItemSelectedClassName =
  "font-semibold text-monitor dark:text-warning";

const dashboardRangeItemIdleClassName =
  "text-muted-foreground hover:text-foreground";

const dashboardRangeTrackClassName =
  "relative inline-flex w-fit max-w-full rounded-snug bg-muted p-0.5";

const dashboardRangeTrackFullWidthClassName =
  "relative flex w-full max-w-full rounded-snug bg-muted p-0.5";

type DashboardRangeToggleProps<T extends string> = {
  value: T;
  options: Array<DashboardRangeOption<T>>;
  onValueChange: (value: T) => void;
  "aria-label": string;
  className?: string;
  fullWidth?: boolean;
};

export function DashboardRangeToggle<T extends string>({
  value,
  options,
  onValueChange,
  "aria-label": ariaLabel,
  className,
  fullWidth = false,
}: DashboardRangeToggleProps<T>) {
  return (
    <div
      className={cn(
        "min-w-0",
        fullWidth ? "w-full" : "w-fit max-w-full",
        !fullWidth && "dashboard-range-toggle",
        className,
      )}
    >
      <SlidingSegmentedControl
        value={value}
        onValueChange={(next) => onValueChange(next as T)}
        aria-label={ariaLabel}
        className={
          fullWidth
            ? dashboardRangeTrackFullWidthClassName
            : dashboardRangeTrackClassName
        }
      >
        {options.map((option) => {
          const selected = value === option.value;
          const displayLabel = option.label ?? option.shortLabel;

          return (
            <SlidingSegmentedControlItem
              key={option.value}
              value={option.value}
              aria-label={displayLabel}
              title={option.label}
              className={cn(
                dashboardRangeItemClassName,
                fullWidth && dashboardRangeItemFullWidthClassName,
                selected
                  ? dashboardRangeItemSelectedClassName
                  : dashboardRangeItemIdleClassName,
              )}
            >
              {option.shortLabel}
            </SlidingSegmentedControlItem>
          );
        })}
      </SlidingSegmentedControl>
    </div>
  );
}
