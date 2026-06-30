import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SettingsPreferenceGroupProps = {
  children: ReactNode;
  className?: string;
};

function SettingsPreferenceGroup({
  children,
  className,
}: SettingsPreferenceGroupProps) {
  return (
    <div
      className={cn(
        "flex max-w-xl flex-col overflow-hidden rounded-sm border border-border bg-card [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { SettingsPreferenceGroup };
