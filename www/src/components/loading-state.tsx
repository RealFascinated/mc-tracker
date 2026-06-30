import { Spinner } from "@/components/spinner"
import { cn } from "@/lib/utils"

type LoadingStateProps = {
  message?: string
  className?: string
  centered?: boolean
}

function LoadingState({
  message = "Loading…",
  className,
  centered = false,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 text-muted-foreground",
        centered && "min-h-svh items-center justify-center",
        className
      )}
    >
      <Spinner />
      <span>{message}</span>
    </div>
  )
}

export { LoadingState }
