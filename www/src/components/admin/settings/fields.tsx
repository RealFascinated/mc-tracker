import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "cnfast";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="app-shell-section">
      <div className="app-shell-section-header">
        <h2 className="app-shell-section-title">{title}</h2>
        {description ? (
          <p className="app-shell-section-description">{description}</p>
        ) : null}
      </div>
      <div className="app-shell-section-body flex flex-col gap-5">
        {children}
      </div>
    </section>
  );
}

export function SettingsSubsection({
  title,
  description,
  children,
  bordered = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        bordered && "border-t border-border pt-5",
      )}
    >
      <div className="grid gap-0.5">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function SettingsFieldGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {children}
    </div>
  );
}

export function SettingsField({
  label,
  htmlFor,
  hint,
  switchControl = false,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  switchControl?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (switchControl) {
    return (
      <div
        className={cn(
          "flex items-start justify-between gap-4 rounded-snug border border-border bg-muted/20 px-4 py-3",
          className,
        )}
      >
        <div className="grid min-w-0 gap-1">
          <Label
            htmlFor={htmlFor}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </Label>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div className="shrink-0 pt-0.5">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="grid gap-1">
        <Label
          htmlFor={htmlFor}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
