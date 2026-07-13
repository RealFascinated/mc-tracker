import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { cn } from "cnfast";

import { ChatAssistantTurn } from "@/components/chat/turns/assistant-turn";
import { ChatErrorTurn } from "@/components/chat/turns/error-turn";
import type { ChatMessage, ChatDisplayPrefs } from "@/components/chat/lib/types";

export function ChatBubble({
  message,
  isStreaming,
  displayPrefs,
  onRetry,
}: {
  message: ChatMessage;
  isStreaming: boolean;
  displayPrefs: ChatDisplayPrefs;
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
    return (
      <ChatAssistantTurn
        message={message}
        isStreaming={isStreaming}
        displayPrefs={displayPrefs}
      />
    );
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
