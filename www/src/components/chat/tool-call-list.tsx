import { CircleCheckIcon, WrenchIcon } from "lucide-react";

import { toolStatusLabel } from "@/components/chat/chat-utils";

export function ToolCallList({
  toolCalls,
  activeTool,
}: {
  toolCalls: string[];
  activeTool: string | null;
}) {
  if (toolCalls.length === 0 && !activeTool) {
    return null;
  }

  return (
    <ul className="mb-2 space-y-0.5 border-b border-border/60 pb-2 last:mb-0 last:border-0 last:pb-0">
      {toolCalls.map((name, index) => (
        <li
          key={`${name}-${index}`}
          className="text-muted-foreground flex items-center gap-1.5 text-xs"
        >
          <CircleCheckIcon className="size-3.5 shrink-0 stroke-[1.75]" />
          {toolStatusLabel(name)}
        </li>
      ))}
      {activeTool ? (
        <li className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <WrenchIcon className="size-3.5 shrink-0 animate-pulse stroke-[1.75]" />
          {toolStatusLabel(activeTool)}
        </li>
      ) : null}
    </ul>
  );
}
