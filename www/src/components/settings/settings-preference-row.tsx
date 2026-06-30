import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type SettingsPreferenceRowProps = {
  label: string
  description: string
  control: ReactNode
  className?: string
}

function SettingsPreferenceRow({
  label,
  description,
  control,
  className,
}: SettingsPreferenceRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-8",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="shrink-0 sm:pt-0.5">{control}</div>
    </div>
  )
}

export { SettingsPreferenceRow }
