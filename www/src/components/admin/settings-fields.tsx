import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "cnfast";

export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-group">
      <h2 className="settings-group-title">{title}</h2>
      <div className="settings-fields">{children}</div>
    </section>
  );
}

export function SettingsField({
  label,
  htmlFor,
  hint,
  switchControl = false,
  children,
}: {
  label: string;
  htmlFor: string;
  hint: string;
  switchControl?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="settings-field">
      <div className="settings-field-label">
        <Label htmlFor={htmlFor} className="font-normal text-muted-foreground">
          {label}
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="settings-field-info"
              aria-label={`About ${label}`}
            >
              <CircleHelp className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <div
        className={cn(
          switchControl
            ? "settings-field-control--switch"
            : "settings-field-control",
        )}
      >
        {children}
      </div>
    </div>
  );
}
