import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth/context";
import { formatLocaleInteger, formatQuotaResetAt } from "@/lib/formatter";
import { chatQuotaExempt } from "@/lib/user-flags";
import { cn } from "cnfast";

export function AccountChatQuotaSection() {
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  if (!user) {
    return null;
  }

  const unlimited = chatQuotaExempt(user.flags);
  const quota = user.chatQuota;

  if (!unlimited && !quota) {
    return null;
  }

  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? 0;
  const remaining = Math.max(0, limit - used);
  const usagePercent =
    unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const exhausted = !unlimited && remaining === 0;
  const resetLabel = quota ? formatQuotaResetAt(quota.resetsAt) : null;

  return (
    <section className="app-shell-section">
      <div className="app-shell-section-header">
        <h2 className="app-shell-section-title">Chat assistant</h2>
        <p className="app-shell-section-description">
          Weekly message allowance for the tracker chat assistant.
        </p>
      </div>
      <div className="app-shell-section-body">
        {unlimited ? (
          <div className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              Unlimited
            </Badge>
            <p className="text-sm text-muted-foreground">
              Your account can send chat messages without a weekly limit.
            </p>
          </div>
        ) : quota ? (
          <div className="flex max-w-md flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    exhausted ? "text-destructive" : "text-foreground",
                  )}
                >
                  {exhausted
                    ? "Weekly limit reached"
                    : `${formatLocaleInteger(remaining)} of ${formatLocaleInteger(limit)} messages left`}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatLocaleInteger(used)} used
                </span>
              </div>
              <Progress
                value={usagePercent}
                aria-label="Weekly chat quota usage"
                className={cn(
                  "h-2 rounded-full bg-muted/80",
                  exhausted &&
                    "**:data-[slot=progress-indicator]:bg-destructive",
                )}
              />
            </div>
            {resetLabel ? (
              <dl className="grid gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Resets
                </dt>
                <dd className="text-sm text-foreground">{resetLabel}</dd>
              </dl>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
