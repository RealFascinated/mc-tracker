import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { Collapsible } from "@/components/ui/collapsible/root";
import { CollapsibleContent } from "@/components/ui/collapsible/content";
import { CollapsibleTrigger } from "@/components/ui/collapsible/trigger";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { cn } from "cnfast";

import { ThinkingIndicator } from "@/components/chat/panel/thinking-indicator";
import type { ChatReasoningPart } from "@/components/chat/lib/types";

export function ChatThinkingBlock({
  part,
  messageId,
  defaultExpanded,
}: {
  part: ChatReasoningPart;
  messageId: string;
  defaultExpanded: boolean;
}) {
  const hasContent = part.content.trim().length > 0;
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const expanded = part.streaming
    ? (manualExpanded ?? defaultExpanded)
    : (manualExpanded ?? false);

  if (!hasContent && part.streaming) {
    return (
      <MessageScrollerItem messageId={`${messageId}:${part.id}`}>
        <div className="flex w-full min-w-0 justify-start">
          <ThinkingIndicator />
        </div>
      </MessageScrollerItem>
    );
  }

  if (!hasContent) {
    return null;
  }

  return (
    <MessageScrollerItem messageId={`${messageId}:${part.id}`}>
      <div className="flex w-full min-w-0 justify-start">
        <Collapsible
          open={expanded}
          onOpenChange={setManualExpanded}
          className="max-w-[88%] min-w-0"
        >
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs">
            {expanded ? (
              <ChevronDownIcon className="size-3.5 shrink-0" />
            ) : (
              <ChevronRightIcon className="size-3.5 shrink-0" />
            )}
            {part.streaming ? "Thinking…" : "Thought"}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p
              className={cn(
                "text-muted-foreground mt-1 text-xs whitespace-pre-wrap",
                part.streaming && "shimmer",
              )}
            >
              {part.content}
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </MessageScrollerItem>
  );
}
