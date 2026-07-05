import { useEffect, useLayoutEffect, useRef } from "react";
import {
  useMessageScroller,
  useMessageScrollerScrollable,
} from "@shadcn/react/message-scroller";

import type { ChatMessage } from "@/components/chat/chat-types";

function scrollFingerprint(messages: ChatMessage[]): string {
  return messages
    .map(
      (m) =>
        `${m.id}:${m.content.length}:${m.reasoning?.length ?? 0}:${(m.toolCalls ?? []).length}`,
    )
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
  const fingerprint = scrollFingerprint(messages);

  useEffect(() => {
    if (isStreaming) {
      stickToBottom.current = true;
    }
  }, [isStreaming]);

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
