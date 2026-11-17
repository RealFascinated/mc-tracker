import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  apiErrorDetail,
  errorMessage,
  statusErrorMessage,
} from "@/lib/api/error-message";

type QueryErrorStateProps = {
  title?: string;
  error?: unknown;
  description?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
};

function QueryErrorState({
  title = "Couldn't load this page",
  error,
  description,
  onRetry,
  isRetrying = false,
  className,
}: QueryErrorStateProps) {
  const message =
    description ??
    (error ? (statusErrorMessage(error) ?? errorMessage(error)) : undefined);
  const detail = apiErrorDetail(error);

  return (
    <div
      role="alert"
      className={
        className ??
        "flex flex-col items-center gap-4 rounded-soft border border-border bg-card px-6 py-12 text-center shadow-sm"
      }
    >
      <span className="flex size-9 items-center justify-center rounded-snug bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {message ?? "The tracker did not respond in time."}
        </p>
        {detail ? (
          <p className="font-mono text-xs text-muted-foreground/70">{detail}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="highlighted" size="lg" onClick={onRetry}>
          <RotateCw className={isRetrying ? "animate-spin" : undefined} />
          {isRetrying ? "Retrying…" : "Try again"}
        </Button>
      ) : null}
    </div>
  );
}

export { QueryErrorState };
