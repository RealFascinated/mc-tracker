import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import {
  CircleCheckIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  SendIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { Button } from "@/components/ui/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { ChatContextServer, ChatTokenUsage } from "@/lib/api/chat";
import { ChatStreamError, streamChat } from "@/lib/api/chat";
import { serverQueryOptions } from "@/lib/api/servers.queries";
import { cn } from "cnfast";

const STREAMING_ID = "streaming";

const DEFAULT_SUGGESTIONS = [
  "Which server gained the most players this month?",
  "How is Hypixel trending this week?",
  "What hosting providers run the most servers?",
  "Which servers are at their peak right now?",
] as const;

function serverSuggestions(serverName: string): string[] {
  return [
    `How is ${serverName} trending this week?`,
    `What was ${serverName}'s peak in the last 24 hours?`,
    `How does ${serverName} compare to other servers?`,
    `What ASN does ${serverName} use?`,
  ];
}

function useServerPageContext(): ChatContextServer | undefined {
  const serverId = useRouterState({
    select: (state) => {
      const match = /^\/servers\/([^/]+)$/.exec(state.location.pathname);
      return match?.[1];
    },
  });
  const { data } = useQuery({
    ...serverQueryOptions(serverId ?? ""),
    enabled: !!serverId,
  });
  if (!serverId || !data?.name) {
    return undefined;
  }
  return { serverId, serverName: data.name };
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
};

function toolStatusLabel(name: string): string {
  return name.replaceAll("_", " ");
}

function formatTokenCount(value: number): string {
  if (value >= 10_000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toLocaleString();
}

function ContextUsage({ usage }: { usage: ChatTokenUsage }) {
  const ratio = usage.promptTokens / usage.contextMax;
  const hot = ratio >= 0.85;

  return (
    <p
      className={cn(
        "text-xs tabular-nums",
        hot ? "text-destructive" : "text-muted-foreground",
      )}
      title="Prompt tokens / context window"
    >
      Context {formatTokenCount(usage.promptTokens)} /{" "}
      {formatTokenCount(usage.contextMax)}
    </p>
  );
}

function ChatSuggestions({
  disabled,
  onPick,
  serverName,
}: {
  disabled: boolean;
  onPick: (text: string) => void;
  serverName?: string;
}) {
  const suggestions = serverName
    ? serverSuggestions(serverName)
    : DEFAULT_SUGGESTIONS;

  return (
    <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
      <MessageCircleIcon className="text-muted-foreground size-8 stroke-1" />
      <p className="text-sm font-medium text-foreground">
        {serverName ? `Ask about ${serverName}` : "Ask about tracked servers"}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onPick(suggestion)}
            className="rounded-soft border border-border bg-card px-3 py-1.5 text-center text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingIndicator({ label = "Thinking…" }: { label?: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-2 text-xs italic">
      <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" />
      {label}
    </span>
  );
}

function ToolCallList({
  toolCalls,
  activeTool,
}: {
  toolCalls: string[];
  activeTool: string | null;
}) {
  if (toolCalls.length === 0 && !activeTool) {
    return null;
  }

  return (
    <ul className="mb-2 space-y-0.5 border-b border-border/60 pb-2 last:mb-0 last:border-0 last:pb-0">
      {toolCalls.map((name, index) => (
        <li
          key={`${name}-${index}`}
          className="text-muted-foreground flex items-center gap-1.5 text-xs"
        >
          <CircleCheckIcon className="size-3.5 shrink-0 stroke-[1.75]" />
          {toolStatusLabel(name)}
        </li>
      ))}
      {activeTool ? (
        <li className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <WrenchIcon className="size-3.5 shrink-0 animate-pulse stroke-[1.75]" />
          {toolStatusLabel(activeTool)}
        </li>
      ) : null}
    </ul>
  );
}

function ChatBubble({
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
            pending && "text-muted-foreground italic",
          )}
        >
          {pending ? (
            <span className="inline-flex flex-col gap-2">
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
              ) : isStreaming ? (
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

export function TrackerChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<ChatTokenUsage | null>(null);
  // Opaque LLM message list echoed back next turn for llama.cpp cache reuse.
  const [rawHistory, setRawHistory] = useState<unknown[] | null>(null);
  const serverContext = useServerPageContext();
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pickSuggestion = useCallback((text: string) => {
    setInput(text);
    inputRef.current?.focus();
  }, []);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      cancelStream();
    }
  }, [cancelStream, open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) {
      return;
    }

    cancelStream();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const nextMessages = [
      ...messages,
      userMessage,
      { id: STREAMING_ID, role: "assistant" as const, content: "" },
    ];
    setMessages(nextMessages);
    setInput("");
    setIsStreaming(true);
    setToolStatus(null);

    const controller = new AbortController();
    abortRef.current = controller;

    // Accumulate streamed text locally so we can append it to raw_history
    // on Done, giving the backend the exact prefix it will see next turn.
    let accumulated = "";

    try {
      await streamChat(
        {
          message: text,
          rawHistory: rawHistory ?? undefined,
          contextServer: serverContext,
          sessionId,
        },
        (event) => {
          switch (event.type) {
            case "toolStart":
              setToolStatus(toolStatusLabel(event.name));
              break;
            case "toolDone":
              setMessages((current) =>
                current.map((message) =>
                  message.id === STREAMING_ID
                    ? {
                        ...message,
                        toolCalls: [...(message.toolCalls ?? []), event.name],
                      }
                    : message,
                ),
              );
              setToolStatus(null);
              break;
            case "delta":
              accumulated += event.content;
              setToolStatus(null);
              setMessages((current) =>
                current.map((message) =>
                  message.id === STREAMING_ID
                    ? { ...message, content: message.content + event.content }
                    : message,
                ),
              );
              break;
            case "error":
              throw new ChatStreamError(event.message, 0);
            case "done":
              if (event.rawHistory) {
                // Append the assistant reply so the next turn's prefix includes
                // both the tool exchanges and the final response text.
                setRawHistory([
                  ...event.rawHistory,
                  { role: "assistant", content: accumulated },
                ]);
              }
              if (event.usage) {
                setTokenUsage(event.usage);
              }
              setMessages((current) =>
                current.map((msg) =>
                  msg.id === STREAMING_ID
                    ? {
                        ...msg,
                        id: crypto.randomUUID(),
                        toolCalls:
                          event.toolCalls?.map((tool) => tool.name) ??
                          msg.toolCalls,
                      }
                    : msg,
                ),
              );
              break;
          }
        },
        controller.signal,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages((current) =>
          current.filter((message) => message.id !== STREAMING_ID),
        );
        return;
      }
      const errorMessage =
        error instanceof ChatStreamError
          ? error.message
          : "Chat request failed";
      toast.error(errorMessage);
      setMessages((current) =>
        current.filter((msg) => msg.id !== STREAMING_ID),
      );
    } finally {
      setIsStreaming(false);
      setToolStatus(null);
      abortRef.current = null;
    }
  }, [
    cancelStream,
    input,
    isStreaming,
    messages,
    rawHistory,
    serverContext,
    sessionId,
  ]);

  return (
    <>
      {open ? (
        <DashboardCard className="fixed right-4 bottom-4 z-50 flex h-[min(32rem,calc(100dvh-2rem))] w-[min(26rem,calc(100vw-2rem))] flex-col shadow-lg">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-foreground">
                Tracker Assistant
              </h2>
              <p className="text-muted-foreground text-xs">
                Player counts, trends, and peaks
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <XIcon />
            </Button>
          </header>

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
                        disabled={isStreaming}
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
            {tokenUsage ? (
              <div className="px-3 pt-2">
                <ContextUsage usage={tokenUsage} />
              </div>
            ) : null}
            <form
              className="flex items-center gap-2 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={1}
                placeholder="Message…"
                disabled={isStreaming}
                className="monitor-input h-10! min-h-10 max-h-24 flex-1 resize-none overflow-y-auto px-3 py-0 text-sm leading-10"
              />
              <Button
                type="submit"
                variant="brand"
                size="icon"
                className="size-10 shrink-0"
                disabled={isStreaming || !input.trim()}
                aria-label="Send message"
              >
                <SendIcon />
              </Button>
            </form>
          </div>
        </DashboardCard>
      ) : null}

      <Button
        type="button"
        variant="brand"
        size="icon-lg"
        className={cn(
          "fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg",
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
