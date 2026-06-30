import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  SlidingSegmentedControl,
  SlidingSegmentedControlItem,
} from "@/components/ui/sliding-segmented-control";
import { cn } from "@/lib/utils";

type DashboardCardProps = {
  children: ReactNode;
  className?: string;
};

function DashboardCard({ children, className }: DashboardCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-soft border border-border bg-card shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

type DashboardCardHeaderProps = {
  title: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  trailingAction?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
};

function DashboardCardHeader({
  title,
  icon: Icon,
  actions,
  trailingAction,
  subtitle,
  className,
}: DashboardCardHeaderProps) {
  return (
    <div className={cn("border-b border-border px-4 py-3", className)}>
      <div
        className={cn(
          "flex justify-between gap-3",
          subtitle ? "items-start" : "items-center",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {Icon ? (
              <Icon className="size-4 shrink-0 text-muted-foreground" />
            ) : null}
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          </div>
          {subtitle ? (
            <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {trailingAction ? (
          <div className="shrink-0">{trailingAction}</div>
        ) : null}
      </div>
      {actions ? <div className="mt-3 min-w-0">{actions}</div> : null}
    </div>
  );
}

type DashboardRangeOption<T extends string> = {
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

function DashboardRangeToggle<T extends string>({
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

export {
  DashboardCard,
  DashboardCardHeader,
  DashboardRangeToggle,
  type DashboardRangeOption,
};
