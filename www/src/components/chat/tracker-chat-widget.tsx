import { useCallback, useEffect, useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MessageCircleIcon,
  MessageSquarePlusIcon,
  SendIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Button } from "@/components/ui/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth/context";
import { cn } from "cnfast";

import { ChatAuthGate } from "@/components/chat/chat-auth-gate";
import { ChatAutoScroll } from "@/components/chat/chat-auto-scroll";
import { ChatHistorySheet } from "@/components/chat/chat-history-sheet";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { ChatSuggestions } from "@/components/chat/chat-suggestions";
import { ContextUsage } from "@/components/chat/context-usage";
import { QuotaUsage } from "@/components/chat/quota-usage";
import { useChatSession } from "@/hooks/use-chat-session";
import { useChatWindowSize } from "@/hooks/use-chat-window-size";

export function TrackerChatWidget() {
  const { isLoading, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [enterAnimationDone, setEnterAnimationDone] = useState(false);
  const [followUpSuggestionsExpanded, setFollowUpSuggestionsExpanded] =
    useState(true);
  const {
    messages,
    input,
    setInput,
    isStreaming,
    toolStatus,
    tokenUsage,
    chatQuota,
    quotaExceeded,
    serverContext,
    sessionId,
    inputRef,
    pickSuggestion,
    cancelStream,
    startNewChat,
    loadSession,
    canStartNewChat,
    sendMessage,
    truncatedNotice,
  } = useChatSession();
  const {
    size: chatWindowSize,
    isResizable,
    isResizing,
    onResizePointerDown,
  } = useChatWindowSize();

  const openChat = useCallback(() => {
    setMounted(true);
    setEnterAnimationDone(false);
    setOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    cancelStream();
    setOpen(false);
  }, [cancelStream]);

  useEffect(() => {
    if (isResizing) {
      setEnterAnimationDone(true);
    }
  }, [isResizing]);

  const panelOpen = open && isAuthenticated;

  useEffect(() => {
    if (!isAuthenticated) {
      cancelStream();
    }
  }, [isAuthenticated, cancelStream]);

  useEffect(() => {
    if (!panelOpen) {
      return;
    }
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [panelOpen, inputRef]);

  if (isLoading) {
    return null;
  }

  return (
    <>
      {mounted ? (
        <div
          style={{
            width: chatWindowSize.width,
            height: chatWindowSize.height,
          }}
          className={cn(
            "fixed right-4 bottom-4 z-50 origin-bottom-right",
            isResizing && "transition-none",
            !isResizing &&
              panelOpen &&
              !enterAnimationDone &&
              "duration-200 animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95",
            !isResizing &&
              !panelOpen &&
              "pointer-events-none duration-200 animate-out fade-out-0 zoom-out-95 fill-mode-forwards",
          )}
          onAnimationEnd={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }
            if (panelOpen) {
              setEnterAnimationDone(true);
              return;
            }
            event.currentTarget.style.opacity = "0";
            event.currentTarget.style.pointerEvents = "none";
            setMounted(false);
          }}
        >
          <DashboardCard className="flex h-full flex-col border-monitor/25 shadow-2xl ring-1 ring-black/10 dark:border-warning/30 dark:ring-white/10">
            {isResizable ? (
              <button
                type="button"
                aria-label="Resize chat window"
                className="absolute top-0 left-0 z-10 size-4 cursor-nwse-resize touch-none border-0 bg-transparent p-0"
                onPointerDown={onResizePointerDown}
              />
            ) : null}
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
                    <ChatHistorySheet onLoadSession={loadSession} />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="New chat"
                          disabled={!canStartNewChat}
                          onClick={startNewChat}
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
                  onClick={closeChat}
                >
                  <XIcon />
                </Button>
              </div>
            </header>

            {!isAuthenticated ? (
              <ChatAuthGate />
            ) : (
              <>
                <div className="min-h-0 flex-1">
                  <MessageScrollerProvider
                    autoScroll
                    defaultScrollPosition="end"
                    scrollPreviousItemPeek={48}
                  >
                    <ChatAutoScroll
                      messages={messages}
                      isStreaming={isStreaming}
                    />
                    <MessageScroller className="min-h-0 flex-1">
                      <MessageScrollerViewport>
                        <MessageScrollerContent
                          aria-busy={isStreaming}
                          className="gap-3 p-4"
                        >
                          {messages.length === 0 ? (
                            <ChatSuggestions
                              disabled={isStreaming || quotaExceeded}
                              onPick={pickSuggestion}
                              rotationKey={`${sessionId}:0`}
                              serverName={serverContext?.serverName}
                            />
                          ) : (
                            messages.map((message) => (
                              <ChatBubble
                                key={message.id}
                                message={message}
                                toolStatus={toolStatus}
                                isStreaming={isStreaming}
                              />
                            ))
                          )}
                        </MessageScrollerContent>
                      </MessageScrollerViewport>
                      <MessageScrollerButton />
                    </MessageScroller>
                  </MessageScrollerProvider>
                </div>

                <div className="shrink-0 border-t border-border">
                  {truncatedNotice ? (
                    <p className="text-muted-foreground border-b border-border px-4 py-2 text-xs">
                      Older messages were omitted from the model context. Full
                      history is still saved.
                    </p>
                  ) : null}
                  {messages.length > 0 &&
                  !isStreaming &&
                  followUpSuggestionsExpanded ? (
                    <div className="px-3 pt-2">
                      <ChatSuggestions
                        variant="follow-up"
                        disabled={quotaExceeded}
                        onPick={pickSuggestion}
                        rotationKey={`${sessionId}:${messages.length}`}
                        serverName={serverContext?.serverName}
                      />
                    </div>
                  ) : null}
                  {chatQuota ? (
                    <div className="px-3 pt-2">
                      <QuotaUsage quota={chatQuota} />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 p-3">
                    {messages.length > 0 && !isStreaming ? (
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
                        onClick={() =>
                          setFollowUpSuggestionsExpanded((current) => !current)
                        }
                      >
                        {followUpSuggestionsExpanded ? (
                          <ChevronDownIcon />
                        ) : (
                          <ChevronUpIcon />
                        )}
                      </Button>
                    ) : null}
                    <textarea
                      ref={inputRef}
                      value={input}
                      aria-label="Chat message"
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      rows={1}
                      placeholder={
                        quotaExceeded ? "Weekly limit reached" : "Message…"
                      }
                      disabled={isStreaming || quotaExceeded}
                      className="monitor-input h-10! min-h-10 max-h-24 flex-1 resize-none overflow-y-auto px-3 py-0 text-sm leading-10"
                    />
                    <Button
                      type="button"
                      variant={isStreaming ? "destructive" : "brand"}
                      size="icon"
                      className="size-10 shrink-0"
                      disabled={
                        !isStreaming && (quotaExceeded || !input.trim())
                      }
                      aria-label={
                        isStreaming ? "Stop response" : "Send message"
                      }
                      onClick={() => {
                        if (isStreaming) {
                          cancelStream();
                          return;
                        }
                        void sendMessage();
                      }}
                    >
                      {isStreaming ? <SquareIcon /> : <SendIcon />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DashboardCard>
        </div>
      ) : null}

      <Button
        type="button"
        variant="brand"
        size="icon-lg"
        className={cn(
          "fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg ring-2 ring-background transition-all duration-200",
          panelOpen && "pointer-events-none scale-0 opacity-0",
        )}
        aria-label="Open chat"
        aria-hidden={panelOpen}
        onClick={openChat}
      >
        <MessageCircleIcon className="size-5" />
      </Button>
    </>
  );
}
