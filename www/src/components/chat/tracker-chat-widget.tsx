import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CircleCheckIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  MessageSquarePlusIcon,
  SendIcon,
  SquareIcon,
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
import { useAuth } from "@/lib/auth/context";
import type { ChatQuota } from "@/lib/auth/types";
import { serverQueryOptions } from "@/lib/api/servers.queries";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

function formatTokenCountFull(value: number): string {
  return value.toLocaleString();
}

function ContextUsageTooltip({ usage }: { usage: ChatTokenUsage }) {
  const ratio = Math.min(usage.promptTokens / usage.contextMax, 1);
  const pct = Math.round(ratio * 100);
  const hot = ratio >= 0.85;
  const cached = usage.cachedTokens ?? 0;
  const hasCache = cached > 0;
  const cachePct =
    hasCache && usage.promptTokens > 0
      ? Math.round((cached / usage.promptTokens) * 100)
      : null;

  return (
    <div className="grid w-52 gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-popover-foreground font-medium">Context window</p>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            hot ? "text-destructive" : "text-popover-foreground",
          )}
        >
          {pct}%
        </p>
      </div>

      <div
        className="bg-muted h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Context window usage"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            hot ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <dl className="grid gap-1.5 text-[11px] leading-tight">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Prompt</dt>
          <dd className="text-popover-foreground tabular-nums">
            {formatTokenCountFull(usage.promptTokens)}
            <span className="text-muted-foreground">
              {" "}
              / {formatTokenCountFull(usage.contextMax)}
            </span>
          </dd>
        </div>
        {hasCache ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Cached</dt>
            <dd className="text-popover-foreground tabular-nums">
              {formatTokenCountFull(cached)}
              {cachePct != null ? (
                <span className="text-muted-foreground"> ({cachePct}%)</span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {usage.completionTokens > 0 ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Response</dt>
            <dd className="text-popover-foreground tabular-nums">
              {formatTokenCountFull(usage.completionTokens)}
            </dd>
          </div>
        ) : null}
        {usage.cacheWriteTokens != null && usage.cacheWriteTokens > 0 ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Cache write</dt>
            <dd className="text-popover-foreground tabular-nums">
              {formatTokenCountFull(usage.cacheWriteTokens)}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function ContextUsage({
  usage,
  tooltipSide = "bottom",
}: {
  usage: ChatTokenUsage;
  tooltipSide?: "top" | "bottom";
}) {
  const ratio = Math.min(usage.promptTokens / usage.contextMax, 1);
  const pct = Math.round(ratio * 100);
  const hot = ratio >= 0.85;
  const size = 18;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(hot ? "text-destructive" : "text-muted-foreground")}
          aria-label={`Context ${pct}% used`}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90"
            aria-hidden
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              className="opacity-25"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
            />
          </svg>
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side={tooltipSide}
        sideOffset={6}
        className="max-w-none flex-col items-stretch gap-0 px-3 py-2.5"
      >
        <ContextUsageTooltip usage={usage} />
      </TooltipContent>
    </Tooltip>
  );
}

function QuotaUsage({ quota }: { quota: ChatQuota }) {
  const remaining = Math.max(0, quota.limit - quota.used);
  const exhausted = remaining === 0;
  const resetLabel = new Date(quota.resetsAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <p
      className={cn(
        "text-xs tabular-nums",
        exhausted ? "text-destructive" : "text-muted-foreground",
      )}
      title={exhausted ? `Resets ${resetLabel}` : undefined}
    >
      {exhausted
        ? `Weekly limit reached — resets ${resetLabel}`
        : `${remaining} of ${quota.limit} messages left this week`}
    </p>
  );
}

function ChatAuthGate() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <MessageCircleIcon className="text-muted-foreground size-8 stroke-1" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Sign in to use the assistant
        </p>
        <p className="text-muted-foreground text-xs">
          Ask about player counts, trends, and peaks across tracked servers.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button variant="brand" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/signup">Create account</Link>
        </Button>
      </div>
    </div>
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
  const { user, isLoading, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<ChatTokenUsage | null>(null);
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);
  // Opaque LLM message list echoed back next turn for llama.cpp cache reuse.
  const [rawHistory, setRawHistory] = useState<unknown[] | null>(null);
  const serverContext = useServerPageContext();
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatQuota = useMemo(() => {
    if (user?.role === "admin" || !user?.chatQuota) {
      return null;
    }
    return { ...user.chatQuota, used: quotaUsed ?? user.chatQuota.used };
  }, [user, quotaUsed]);

  const quotaExceeded = chatQuota !== null && chatQuota.used >= chatQuota.limit;

  useEffect(() => {
    if (user?.chatQuota) {
      setQuotaUsed(user.chatQuota.used);
    } else {
      setQuotaUsed(null);
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) {
      setOpen(false);
    }
  }, [isAuthenticated]);

  const pickSuggestion = useCallback((text: string) => {
    setInput(text);
    inputRef.current?.focus();
  }, []);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const startNewChat = useCallback(() => {
    cancelStream();
    setMessages([]);
    setRawHistory(null);
    setTokenUsage(null);
    setToolStatus(null);
    setInput("");
    setIsStreaming(false);
    setSessionId(crypto.randomUUID());
    inputRef.current?.focus();
  }, [cancelStream]);

  const canStartNewChat =
    isAuthenticated && (messages.length > 0 || isStreaming || rawHistory != null);

  useEffect(() => {
    if (!open) {
      cancelStream();
    }
  }, [cancelStream, open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || quotaExceeded) {
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
      if (chatQuota) {
        setQuotaUsed((current) => (current ?? chatQuota.used) + 1);
      }
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
      if (
        error instanceof ChatStreamError &&
        error.status === 429 &&
        chatQuota
      ) {
        setQuotaUsed(chatQuota.limit);
      }
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
    quotaExceeded,
    chatQuota,
  ]);

  if (isLoading) {
    return null;
  }

  return (
    <>
      {open ? (
        <DashboardCard className="fixed right-4 bottom-4 z-50 flex h-[min(32rem,calc(100dvh-2rem))] w-[min(26rem,calc(100vw-2rem))] flex-col border-monitor/25 shadow-2xl ring-1 ring-black/10 dark:border-warning/30 dark:ring-white/10">
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
                onClick={() => setOpen(false)}
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
                type={isStreaming ? "button" : "submit"}
                variant={isStreaming ? "outline" : "brand"}
                size="icon"
                className="size-10 shrink-0"
                disabled={!isStreaming && (quotaExceeded || !input.trim())}
                aria-label={isStreaming ? "Stop response" : "Send message"}
                onClick={isStreaming ? cancelStream : undefined}
              >
                {isStreaming ? <SquareIcon /> : <SendIcon />}
              </Button>
            </form>
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
