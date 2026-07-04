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
  const pending =
    message.id === STREAMING_ID && !message.content && isStreaming;
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
              {message.content ? (
                <ChatMarkdown content={message.content} />
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
