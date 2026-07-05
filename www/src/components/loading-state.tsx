import { Spinner } from "@/components/ui/spinner";
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
      <Spinner className="text-monitor dark:text-warning" />
      <span>{message}</span>
    </output>
  );
}

export { LoadingState };
