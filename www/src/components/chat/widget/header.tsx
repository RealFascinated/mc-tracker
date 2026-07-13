import type { ComponentProps } from "react";
import { MessageSquarePlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatTokenUsage } from "@/lib/api/chat";
import type { ChatDisplayPrefs } from "@/components/chat/lib/types";

import { ChatHistorySheet } from "@/components/chat/panel/history-sheet";
import { ContextUsage } from "@/components/chat/panel/context-usage";
import { ChatSettingsPopover } from "@/components/chat/widget/settings-popover";

type TrackerChatHeaderProps = {
  isAuthenticated: boolean;
  tokenUsage: ChatTokenUsage | null;
  sessionId: string;
  canStartNewChat: boolean;
  displayPrefs: ChatDisplayPrefs;
  onShowToolCallsChange: (show: boolean) => void;
  onShowReasoningChange: (show: boolean) => void;
  onLoadSession: ComponentProps<typeof ChatHistorySheet>["onLoadSession"];
  onDeleteActiveSession: () => void;
  onStartNewChat: () => void;
  onClose: () => void;
};

export function TrackerChatHeader({
  isAuthenticated,
  tokenUsage,
  sessionId,
  canStartNewChat,
  displayPrefs,
  onShowToolCallsChange,
  onShowReasoningChange,
  onLoadSession,
  onDeleteActiveSession,
  onStartNewChat,
  onClose,
}: TrackerChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold text-foreground">
          Tracker Assistant
        </h2>
        <p className="text-muted-foreground text-xs">
          Player counts, trends, and peaks
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {isAuthenticated && tokenUsage ? (
          <ContextUsage usage={tokenUsage} />
        ) : null}
        {isAuthenticated ? (
          <>
            <ChatSettingsPopover
              prefs={displayPrefs}
              onShowToolCallsChange={onShowToolCallsChange}
              onShowReasoningChange={onShowReasoningChange}
            />
            <ChatHistorySheet
              activeSessionId={sessionId}
              onLoadSession={onLoadSession}
              onDeleteActiveSession={onDeleteActiveSession}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New chat"
                  disabled={!canStartNewChat}
                  onClick={onStartNewChat}
                >
                  <MessageSquarePlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                New chat
              </TooltipContent>
            </Tooltip>
          </>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close chat"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
    </header>
  );
}
