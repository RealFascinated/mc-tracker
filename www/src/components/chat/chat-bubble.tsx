import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { cn } from "cnfast";

import { ChatAssistantTurn } from "@/components/chat/chat-assistant-turn";
import { ChatErrorTurn } from "@/components/chat/chat-error-turn";
import type { ChatMessage } from "@/components/chat/chat-types";

export function ChatBubble({
  message,
  isStreaming,
  onRetry,
}: {
  message: ChatMessage;
  isStreaming: boolean;
  onRetry?: (prompt: string) => void;
}) {
  if (message.role === "error") {
    return (
      <ChatErrorTurn
        message={message}
        disabled={isStreaming}
        onRetry={onRetry ?? (() => {})}
      />
    );
  }

  if (message.role === "assistant") {
    return <ChatAssistantTurn message={message} isStreaming={isStreaming} />;
  }

  return (
    <MessageScrollerItem messageId={message.id} scrollAnchor>
      <div className="flex w-full min-w-0 justify-end">
        <div
          className={cn(
            "max-w-[88%] rounded-soft border border-monitor bg-monitor px-3 py-2 text-sm whitespace-pre-wrap text-white dark:border-monitor-100 dark:bg-monitor/90",
          )}
        >
          {message.content}
        </div>
      </div>
    </MessageScrollerItem>
  );
}
