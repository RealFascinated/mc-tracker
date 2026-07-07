import { AlertCircleIcon, RotateCcwIcon } from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MessageScrollerItem } from "@/components/ui/message-scroller";

import type { ChatMessage } from "@/components/chat/lib/types";

export function ChatErrorTurn({
  message,
  onRetry,
  disabled,
}: {
  message: ChatMessage;
  onRetry: (prompt: string) => void;
  disabled: boolean;
}) {
  const prompt = message.retryPrompt ?? "";

  return (
    <MessageScrollerItem messageId={message.id} scrollAnchor>
      <div className="flex w-full min-w-0 justify-start">
        <Alert variant="destructive" className="max-w-[88%] rounded-soft">
          <AlertCircleIcon />
          <AlertTitle>Response failed</AlertTitle>
          <AlertDescription>{message.content}</AlertDescription>
          {prompt ? (
            <AlertAction>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onRetry(prompt)}
              >
                <RotateCcwIcon />
                Retry
              </Button>
            </AlertAction>
          ) : null}
        </Alert>
      </div>
    </MessageScrollerItem>
  );
}
