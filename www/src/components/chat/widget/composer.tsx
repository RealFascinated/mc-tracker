import type { RefObject } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SendIcon,
  SquareIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatQuota } from "@/lib/auth/types";

import { ChatSuggestions } from "@/components/chat/panel/suggestions";
import { QuotaUsage } from "@/components/chat/panel/quota-usage";

type TrackerChatComposerProps = {
  sessionId: string;
  messagesCount: number;
  input: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isStreaming: boolean;
  quotaExceeded: boolean;
  truncatedNotice: boolean;
  followUpSuggestionsExpanded: boolean;
  chatQuota: ChatQuota | null;
  serverName?: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onCancelStream: () => void;
  onPickSuggestion: (text: string) => void;
  onToggleFollowUpSuggestions: () => void;
};

export function TrackerChatComposer({
  sessionId,
  messagesCount,
  input,
  inputRef,
  isStreaming,
  quotaExceeded,
  truncatedNotice,
  followUpSuggestionsExpanded,
  chatQuota,
  serverName,
  onInputChange,
  onSendMessage,
  onCancelStream,
  onPickSuggestion,
  onToggleFollowUpSuggestions,
}: TrackerChatComposerProps) {
  return (
    <div className="shrink-0 border-t border-border">
      {truncatedNotice ? (
        <p className="text-muted-foreground border-b border-border px-4 py-2 text-xs">
          Older messages were omitted from the model context. Full history is
          still saved.
        </p>
      ) : null}
      {messagesCount > 0 && !isStreaming && followUpSuggestionsExpanded ? (
        <div className="px-3 pt-2">
          <ChatSuggestions
            key={`${sessionId}:${messagesCount}`}
            variant="follow-up"
            disabled={quotaExceeded}
            onPick={onPickSuggestion}
            rotationKey={`${sessionId}:${messagesCount}`}
            serverName={serverName}
          />
        </div>
      ) : null}
      {chatQuota ? (
        <div className="px-3 pt-2">
          <QuotaUsage quota={chatQuota} />
        </div>
      ) : null}
      <div className="flex items-center gap-2 p-3">
        {messagesCount > 0 && !isStreaming ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 text-muted-foreground"
                aria-label={
                  followUpSuggestionsExpanded
                    ? "Hide suggestions"
                    : "Show suggestions"
                }
                aria-expanded={followUpSuggestionsExpanded}
                onClick={onToggleFollowUpSuggestions}
              >
                {followUpSuggestionsExpanded ? (
                  <ChevronDownIcon />
                ) : (
                  <ChevronUpIcon />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {followUpSuggestionsExpanded
                ? "Hide suggestions"
                : "Show suggestions"}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <Textarea
          ref={inputRef}
          value={input}
          aria-label="Chat message"
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void onSendMessage();
            }
          }}
          rows={1}
          placeholder={quotaExceeded ? "Weekly limit reached" : "Message…"}
          disabled={isStreaming || quotaExceeded}
          className="h-10! min-h-10 max-h-24 flex-1 resize-none overflow-y-auto px-3 py-0 text-sm leading-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:border-border focus-visible:ring-0"
        />
        <Button
          type="button"
          variant={isStreaming ? "destructive" : "brand"}
          size="icon"
          className="size-10 shrink-0"
          disabled={!isStreaming && (quotaExceeded || !input.trim())}
          aria-label={isStreaming ? "Stop response" : "Send message"}
          onClick={() => {
            if (isStreaming) {
              onCancelStream();
              return;
            }
            void onSendMessage();
          }}
        >
          {isStreaming ? <SquareIcon /> : <SendIcon />}
        </Button>
      </div>
    </div>
  );
}
