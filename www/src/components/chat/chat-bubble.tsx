import { useState } from "react";

import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { cn } from "cnfast";

import { ThinkingIndicator } from "@/components/chat/thinking-indicator";
import { ToolCallList } from "@/components/chat/tool-call-list";
import { STREAMING_ID } from "@/components/chat/chat-types";
import type { ChatMessage } from "@/components/chat/chat-types";

export function ChatBubble({
  message,
  toolStatus,
  isStreaming,
}: {
  message: ChatMessage;
  toolStatus: string | null;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const hasReasoning = (message.reasoning?.trim().length ?? 0) > 0;
  const hasContent = message.content.trim().length > 0;
  const reasoningOnly = hasReasoning && !hasContent;
  const contentKey = message.content;
  const [reasoningExpandedFor, setReasoningExpandedFor] = useState<
    string | null
  >(null);
  const showReasoning =
    reasoningOnly || (hasReasoning && reasoningExpandedFor === contentKey);
  const pending =
    message.id === STREAMING_ID &&
    !message.content &&
    !message.reasoning &&
    isStreaming;
  const toolCalls = message.toolCalls ?? [];
  const activeTool =
    message.id === STREAMING_ID && isStreaming ? toolStatus : null;

  return (
    <MessageScrollerItem scrollAnchor={isUser}>
      <div
        className={cn(
          "flex w-full min-w-0",
          isUser ? "justify-end" : "justify-start",
        )}
      >
        <div
          className={cn(
            "max-w-[88%] px-3 py-2 text-sm",
            isUser
              ? "rounded-soft border border-monitor bg-monitor text-white whitespace-pre-wrap dark:border-monitor-100 dark:bg-monitor/90"
              : "rounded-soft border border-border bg-muted/40 text-foreground",
            pending && "text-muted-foreground",
          )}
        >
          {pending ? (
            <span className="inline-flex flex-col ">
              <ToolCallList toolCalls={toolCalls} activeTool={activeTool} />
              {!activeTool ? <ThinkingIndicator /> : null}
            </span>
          ) : isUser ? (
            message.content
          ) : (
            <>
              <ToolCallList toolCalls={toolCalls} activeTool={null} />
              {hasReasoning && hasContent ? (
                <button
                  type="button"
                  onClick={() =>
                    setReasoningExpandedFor((current) =>
                      current === contentKey ? null : contentKey,
                    )
                  }
                  className="text-muted-foreground hover:text-foreground mb-2 text-xs underline-offset-2 hover:underline"
                >
                  {reasoningExpandedFor === contentKey
                    ? "Hide thinking"
                    : "Show thinking"}
                </button>
              ) : null}
              {showReasoning && message.reasoning ? (
                <p className="text-muted-foreground mb-2 text-xs italic whitespace-pre-wrap">
                  {message.reasoning}
                </p>
              ) : null}
              {message.content ? (
                <ChatMarkdown content={message.content} />
              ) : reasoningOnly ? (
                isStreaming ? (
                  <ThinkingIndicator />
                ) : null
              ) : isStreaming && message.id === STREAMING_ID ? (
                <ThinkingIndicator />
              ) : (
                <p className="text-muted-foreground text-xs italic">
                  No response generated.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </MessageScrollerItem>
  );
}
