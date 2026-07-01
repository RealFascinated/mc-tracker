import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardCardHeaderProps = {
  title: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  trailingAction?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
};

export function DashboardCardHeader({
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
