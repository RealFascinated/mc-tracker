import type { ServerStatus } from "@/lib/api/servers";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "cnfast";

/**
 * Online/offline indicator for a tracked server, driven by the explicit
 * `status` field from the API rather than inferred from the player count.
 */
function ServerStatusDot({
  status,
  className,
}: {
  status: ServerStatus;
  className?: string;
}) {
  const online = status === "online";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={online ? "Online" : "Offline"}
          className={cn(
            "inline-block size-2 shrink-0 rounded-full",
            online ? "status-pulse-dot bg-success" : "bg-error",
            className,
          )}
        />
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className={online ? "text-success" : "text-error"}>
          {online ? "Online" : "Offline"}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export { ServerStatusDot };
