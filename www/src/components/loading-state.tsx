import { Loader2 } from "lucide-react";

import { cn } from "cnfast";

type LoadingStateProps = {
  message?: string;
  className?: string;
  centered?: boolean;
};

function LoadingState({
  message = "Loading…",
  className,
  centered = false,
}: LoadingStateProps) {
  return (
    <output
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 text-muted-foreground",
        centered && "min-h-svh items-center justify-center",
        className,
      )}
    >
      <Loader2
        className="size-4 animate-spin text-monitor dark:text-warning"
        aria-hidden
      />
      <span>{message}</span>
    </output>
  );
}

export { LoadingState };
