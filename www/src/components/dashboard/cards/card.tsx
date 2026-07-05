import type { CSSProperties, ReactNode } from "react";

import { cn } from "cnfast";

type DashboardCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function DashboardCard({ children, className, style }: DashboardCardProps) {
  return (
    <div
      style={style}
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
