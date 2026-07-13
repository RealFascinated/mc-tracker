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

const sectionLabelClass =
  "text-[10px] font-semibold uppercase tracking-widest text-muted-foreground";

function TokenRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-popover-foreground tabular-nums">
        {formatLocaleInteger(value)}
      </dd>
    </div>
  );
}

function ContextUsageTooltip({ usage }: { usage: ChatTokenUsage }) {
  const ratio = Math.min(usage.promptTokens / usage.contextMax, 1);
  const pct = Math.round(ratio * 100);
  const hot = ratio >= 0.85;
  const reasoning = usage.reasoningTokens ?? 0;
  const generation = Math.max(usage.completionTokens - reasoning, 0);

  return (
    <div className="w-56">
      <div className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={sectionLabelClass}>Context window</p>
            <p className="mt-1 text-sm tabular-nums text-popover-foreground">
              {formatLocaleInteger(usage.promptTokens)}
              <span className="text-muted-foreground">
                {" / "}
                {formatLocaleInteger(usage.contextMax)}
              </span>
            </p>
          </div>
          <p
            className={cn(
              "shrink-0 text-lg font-semibold tabular-nums",
              hot ? "text-destructive" : "text-success",
            )}
          >
            {pct}%
          </p>
        </div>

        <Progress
          value={pct}
          aria-label="Context window usage"
          className={cn(
            "mt-2.5 h-1.5 rounded-full bg-muted/80 **:data-[slot=progress-indicator]:rounded-full",
            hot
              ? "**:data-[slot=progress-indicator]:bg-destructive"
              : "**:data-[slot=progress-indicator]:bg-success",
          )}
        />
      </div>

      <div className="border-t border-border" />

      <div className="pt-3">
        <p className={cn(sectionLabelClass, "mb-2")}>Tokens</p>
        <dl className="grid gap-1.5 text-xs leading-tight">
          <TokenRow label="Prompt" value={usage.promptTokens} />
          <TokenRow label="Generation" value={generation} />
          <TokenRow label="Reasoning" value={reasoning} />
        </dl>
      </div>
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
          className={cn(
            hot ? "text-destructive" : "text-success",
          )}
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
        className="max-w-none flex-col items-stretch gap-0 px-4 py-3.5"
      >
        <ContextUsageTooltip usage={usage} />
      </TooltipContent>
    </Tooltip>
  );
}
