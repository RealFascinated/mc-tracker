import type { ReactNode } from "react";

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

export { DashboardCard };
