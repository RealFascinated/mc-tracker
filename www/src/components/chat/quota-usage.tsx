import type { ChatQuota } from "@/lib/auth/types";
import { cn } from "cnfast";

export function QuotaUsage({ quota }: { quota: ChatQuota }) {
  const remaining = Math.max(0, quota.limit - quota.used);
  const exhausted = remaining === 0;
  const resetLabel = new Date(quota.resetsAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <p
      className={cn(
        "text-xs tabular-nums",
        exhausted ? "text-destructive" : "text-muted-foreground",
      )}
      title={exhausted ? `Resets ${resetLabel}` : undefined}
    >
      {exhausted
        ? `Weekly limit reached — resets ${resetLabel}`
        : `${remaining} of ${quota.limit} messages left this week`}
    </p>
  );
}
