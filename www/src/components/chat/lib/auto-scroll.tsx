import { useEffect, useLayoutEffect, useRef } from "react";
import {
  useMessageScroller,
  useMessageScrollerScrollable,
} from "@shadcn/react/message-scroller";

import type { ChatMessage, ChatPart } from "@/components/chat/lib/types";

function partFingerprint(part: ChatPart): string {
  switch (part.kind) {
    case "text":
    case "reasoning":
      return `${part.kind}:${part.content.length}:${part.streaming ? 1 : 0}`;
    case "tool":
      return `tool:${part.name}:${part.status}`;
  }
}

function scrollFingerprint(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      if (message.parts?.length) {
        return `${message.id}:${message.parts.map(partFingerprint).join(",")}`;
      }
      return `${message.id}:${message.content.length}`;
    })
    .join("|");
}

/** Pins the viewport to the bottom while streaming unless the user scrolls up. */
export function ChatAutoScroll({
  messages,
  isStreaming,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
}) {
  const { scrollToEnd } = useMessageScroller();
  const scrollable = useMessageScrollerScrollable();
  const stickToBottom = useRef(true);
  const prevIsStreaming = useRef(isStreaming);
  if (isStreaming && !prevIsStreaming.current) {
    stickToBottom.current = true;
  }
  prevIsStreaming.current = isStreaming;
  const fingerprint = scrollFingerprint(messages);

  useEffect(() => {
    stickToBottom.current = scrollable.end;
  }, [scrollable.end]);

  useLayoutEffect(() => {
    if (!stickToBottom.current) {
      return;
    }
    scrollToEnd({ behavior: "auto" });
  }, [fingerprint, scrollToEnd]);

  return null;
}
