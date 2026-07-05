import type { ChatQuota } from "@/lib/auth/types";
import { formatQuotaResetAt } from "@/lib/formatter";
import { cn } from "cnfast";

export function QuotaUsage({ quota }: { quota: ChatQuota }) {
  const remaining = Math.max(0, quota.limit - quota.used);
  const exhausted = remaining === 0;
  const resetLabel = formatQuotaResetAt(quota.resetsAt);

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
