import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatTokenUsage } from "@/lib/api/chat";
import { cn } from "cnfast";

import { formatLocaleInteger } from "@/lib/formatter";

function ContextUsageTooltip({ usage }: { usage: ChatTokenUsage }) {
  const ratio = Math.min(usage.promptTokens / usage.contextMax, 1);
  const pct = Math.round(ratio * 100);
  const hot = ratio >= 0.85;
  const cached = usage.cachedTokens ?? 0;
  const hasCache = cached > 0;
  const cachePct =
    hasCache && usage.promptTokens > 0
      ? Math.round((cached / usage.promptTokens) * 100)
      : null;

  return (
    <div className="grid w-52 gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-popover-foreground font-medium">Context window</p>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            hot ? "text-destructive" : "text-popover-foreground",
          )}
        >
          {pct}%
        </p>
      </div>

      <Progress
        value={pct}
        aria-label="Context window usage"
        className={cn(
          "h-1.5 rounded-full",
          hot && "[&_[data-slot=progress-indicator]]:bg-destructive",
        )}
      />

      <dl className="grid gap-1.5 text-[11px] leading-tight">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Context</dt>
          <dd className="text-popover-foreground tabular-nums">
            {formatLocaleInteger(usage.promptTokens)}
            <span className="text-muted-foreground">
              {" "}
              / {formatLocaleInteger(usage.contextMax)}
            </span>
          </dd>
        </div>
        {hasCache ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Cached</dt>
            <dd className="text-popover-foreground tabular-nums">
              {formatLocaleInteger(cached)}
              {cachePct != null ? (
                <span className="text-muted-foreground"> ({cachePct}%)</span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {usage.completionTokens > 0 ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Response</dt>
            <dd className="text-popover-foreground tabular-nums">
              {formatLocaleInteger(usage.completionTokens)}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function ContextUsage({
  usage,
  tooltipSide = "bottom",
}: {
  usage: ChatTokenUsage;
  tooltipSide?: "top" | "bottom";
}) {
  const ratio = Math.min(usage.promptTokens / usage.contextMax, 1);
  const pct = Math.round(ratio * 100);
  const hot = ratio >= 0.85;
  const size = 18;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(hot ? "text-destructive" : "text-muted-foreground")}
          aria-label={`Context ${pct}% used`}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90"
            aria-hidden
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              className="opacity-25"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
            />
          </svg>
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side={tooltipSide}
        sideOffset={6}
        className="max-w-none flex-col items-stretch gap-0 px-3 py-2.5"
      >
        <ContextUsageTooltip usage={usage} />
      </TooltipContent>
    </Tooltip>
  );
}
