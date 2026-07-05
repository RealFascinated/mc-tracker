import { CircleCheckIcon, WrenchIcon } from "lucide-react";

import { MessageScrollerItem } from "@/components/ui/message-scroller";

import { toolStatusLabel } from "@/components/chat/chat-utils";
import type { ChatToolPart } from "@/components/chat/chat-types";

export function ChatToolCallRow({
  part,
  messageId,
}: {
  part: ChatToolPart;
  messageId: string;
}) {
  const running = part.status === "running";

  return (
    <MessageScrollerItem messageId={`${messageId}:${part.id}`}>
      <div className="flex w-full min-w-0 justify-start">
        <div className="text-muted-foreground inline-flex max-w-[88%] items-center gap-1.5 text-xs">
          {running ? (
            <WrenchIcon className="size-3.5 shrink-0 animate-pulse stroke-[1.75]" />
          ) : (
            <CircleCheckIcon className="size-3.5 shrink-0 stroke-[1.75]" />
          )}
          {toolStatusLabel(part.name)}
        </div>
      </div>
    </MessageScrollerItem>
  );
}
