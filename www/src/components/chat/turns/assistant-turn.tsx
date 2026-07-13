import { MessageScrollerItem } from "@/components/ui/message-scroller";

import { ChatMarkdown } from "@/components/chat/lib/markdown";
import { visibleAssistantParts } from "@/components/chat/lib/part-utils";
import { ChatThinkingBlock } from "@/components/chat/panel/thinking-block";
import { ChatToolCallRow } from "@/components/chat/turns/tool-call-row";
import { ThinkingIndicator } from "@/components/chat/panel/thinking-indicator";
import { STREAMING_ID } from "@/components/chat/lib/types";
import type { ChatMessage, ChatDisplayPrefs } from "@/components/chat/lib/types";

export function ChatAssistantTurn({
  message,
  isStreaming,
  displayPrefs,
}: {
  message: ChatMessage;
  isStreaming: boolean;
  displayPrefs: ChatDisplayPrefs;
}) {
  const allParts = message.parts ?? [];
  const parts = visibleAssistantParts(allParts, displayPrefs);
  const isStreamingTurn = message.id === STREAMING_ID && isStreaming;
  const hasTextPart = parts.some((part) => part.kind === "text");

  if (parts.length === 0) {
    if (isStreamingTurn) {
      return (
        <MessageScrollerItem messageId={message.id} scrollAnchor>
          <div className="flex w-full min-w-0 justify-start">
            <ThinkingIndicator />
          </div>
        </MessageScrollerItem>
      );
    }

    return (
      <MessageScrollerItem messageId={message.id} scrollAnchor>
        <div className="flex w-full min-w-0 justify-start">
          <div className="max-w-[88%] rounded-soft border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {message.content.trim().length > 0 ? (
              <ChatMarkdown content={message.content} />
            ) : (
              <p className="text-muted-foreground text-xs italic">
                No response generated.
              </p>
            )}
          </div>
        </div>
      </MessageScrollerItem>
    );
  }

  return (
    <>
      {parts.map((part) => {
        switch (part.kind) {
          case "reasoning":
            return (
              <ChatThinkingBlock
                key={part.id}
                part={part}
                messageId={message.id}
                defaultExpanded={part.streaming === true && !hasTextPart}
              />
            );
          case "tool":
            return (
              <ChatToolCallRow
                key={part.id}
                part={part}
                messageId={message.id}
              />
            );
          case "text":
            return (
              <MessageScrollerItem
                key={part.id}
                messageId={`${message.id}:${part.id}`}
                scrollAnchor={message.id === STREAMING_ID}
              >
                <div className="flex w-full min-w-0 justify-start">
                  <div className="max-w-[88%] rounded-soft border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                    <ChatMarkdown content={part.content} />
                  </div>
                </div>
              </MessageScrollerItem>
            );
        }
      })}
      {isStreamingTurn &&
      allParts.length > 0 &&
      allParts.at(-1)?.kind === "tool" ? (
        <MessageScrollerItem messageId={`${message.id}:waiting`}>
          <div className="flex w-full min-w-0 justify-start">
            <ThinkingIndicator />
          </div>
        </MessageScrollerItem>
      ) : null}
    </>
  );
}
