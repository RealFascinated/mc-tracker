import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn(
        "size-4 animate-spin text-monitor dark:text-warning",
        className
      )}
      aria-hidden
    />
  )
}

export { Spinner }
