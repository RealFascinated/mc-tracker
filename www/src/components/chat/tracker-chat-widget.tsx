import { useEffect, useState } from "react";
import {
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
import { ChatBubble } from "@/components/chat/chat-bubble";
import { ChatSuggestions } from "@/components/chat/chat-suggestions";
import { ContextUsage } from "@/components/chat/context-usage";
import { QuotaUsage } from "@/components/chat/quota-usage";
import { useChatSession } from "@/hooks/use-chat-session";

export function TrackerChatWidget() {
  const { isLoading, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
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
    inputRef,
    pickSuggestion,
    cancelStream,
    startNewChat,
    canStartNewChat,
    sendMessage,
  } = useChatSession();

  useEffect(() => {
    if (!isAuthenticated) {
      cancelStream();
      setOpen(false);
    }
  }, [isAuthenticated, cancelStream]);

  useEffect(() => {
    if (!open || !isAuthenticated) {
      return;
    }
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, isAuthenticated, inputRef]);

  if (isLoading) {
    return null;
  }

  return (
    <>
      {open ? (
        <DashboardCard className="fixed right-4 bottom-4 z-50 flex h-[min(38rem,calc(100dvh-2rem))] w-[min(32rem,calc(100vw-2rem))] flex-col border-monitor/25 shadow-2xl ring-1 ring-black/10 dark:border-warning/30 dark:ring-white/10">
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
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close chat"
                onClick={() => {
                  cancelStream();
                  setOpen(false);
                }}
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
                  defaultScrollPosition="last-anchor"
                  scrollPreviousItemPeek={48}
                >
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
                {chatQuota ? (
                  <div className="px-3 pt-2">
                    <QuotaUsage quota={chatQuota} />
                  </div>
                ) : null}
                <div className="flex items-center gap-2 p-3">
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
                    variant={isStreaming ? "outline" : "brand"}
                    size="icon"
                    className="size-10 shrink-0"
                    disabled={!isStreaming && (quotaExceeded || !input.trim())}
                    aria-label={isStreaming ? "Stop response" : "Send message"}
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
      ) : null}

      <Button
        type="button"
        variant="brand"
        size="icon-lg"
        className={cn(
          "fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg ring-2 ring-background",
          open && "pointer-events-none scale-0 opacity-0",
        )}
        aria-label="Open chat"
        aria-hidden={open}
        onClick={() => setOpen(true)}
      >
        <MessageCircleIcon className="size-5" />
      </Button>
    </>
  );
}
