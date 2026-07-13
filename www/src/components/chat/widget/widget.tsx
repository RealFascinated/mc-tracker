import { useCallback, useEffect, useState } from "react";
import { MessageCircleIcon } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/cards/card";
import { Button } from "@/components/ui/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { useAuth } from "@/lib/auth/context";
import { cn } from "cnfast";

import { ChatAuthGate } from "../panel/auth-gate";
import { ChatAutoScroll } from "../lib/auto-scroll";
import { ChatBubble } from "../panel/bubble";
import { ChatSuggestions } from "../panel/suggestions";
import { TrackerChatComposer } from "./composer";
import { TrackerChatHeader } from "./header";
import { useChatSession } from "@/hooks/chat/use-chat-session";
import { useChatDisplayPrefs } from "@/hooks/chat/use-chat-display-prefs";
import { useChatWindowSize } from "@/hooks/chat/use-chat-window-size";

export function TrackerChatWidget() {
  const { isLoading, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [enterAnimationDone, setEnterAnimationDone] = useState(false);
  const [followUpSuggestionsExpanded, setFollowUpSuggestionsExpanded] =
    useState(true);
  const { prefs: displayPrefs, setShowToolCalls, setShowReasoning } =
    useChatDisplayPrefs();
  const {
    messages,
    input,
    setInput,
    isStreaming,
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
    retryMessage,
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
            <TrackerChatHeader
              isAuthenticated={isAuthenticated}
              tokenUsage={tokenUsage}
              sessionId={sessionId}
              canStartNewChat={canStartNewChat}
              displayPrefs={displayPrefs}
              onShowToolCallsChange={setShowToolCalls}
              onShowReasoningChange={setShowReasoning}
              onLoadSession={loadSession}
              onDeleteActiveSession={startNewChat}
              onStartNewChat={startNewChat}
              onClose={closeChat}
            />

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
                              key={`${sessionId}:0`}
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
                                isStreaming={isStreaming}
                                displayPrefs={displayPrefs}
                                onRetry={retryMessage}
                              />
                            ))
                          )}
                        </MessageScrollerContent>
                      </MessageScrollerViewport>
                      <MessageScrollerButton />
                    </MessageScroller>
                  </MessageScrollerProvider>
                </div>

                <TrackerChatComposer
                  sessionId={sessionId}
                  messagesCount={messages.length}
                  input={input}
                  inputRef={inputRef}
                  isStreaming={isStreaming}
                  quotaExceeded={quotaExceeded}
                  truncatedNotice={truncatedNotice}
                  followUpSuggestionsExpanded={followUpSuggestionsExpanded}
                  chatQuota={chatQuota}
                  serverName={serverContext?.serverName}
                  onInputChange={setInput}
                  onSendMessage={sendMessage}
                  onCancelStream={cancelStream}
                  onPickSuggestion={pickSuggestion}
                  onToggleFollowUpSuggestions={() =>
                    setFollowUpSuggestionsExpanded((current) => !current)
                  }
                />
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
