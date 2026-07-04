import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ChatTokenUsage } from "@/lib/api/chat";
import { ChatStreamError, streamChat } from "@/lib/api/chat";
import { useAuth } from "@/lib/auth/context";
import type { ChatQuota } from "@/lib/auth/types";
import { chatQuotaExempt } from "@/lib/user-flags";

import { STREAMING_ID } from "@/components/chat/chat-types";
import type { ChatMessage } from "@/components/chat/chat-types";
import { toolStatusLabel } from "@/components/chat/chat-utils";
import { useChatServerContext } from "@/hooks/use-chat-server-context";

export function useChatSession() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<ChatTokenUsage | null>(null);
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);
  // Opaque LLM message list echoed back each turn to maintain conversation context.
  const [rawHistory, setRawHistory] = useState<unknown[] | null>(null);
  // Ref keeps sendMessage reading the latest value without closure staleness.
  const rawHistoryRef = useRef<unknown[] | null>(null);
  rawHistoryRef.current = rawHistory;
  const serverContext = useChatServerContext();
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatQuota = useMemo((): ChatQuota | null => {
    if (!user || chatQuotaExempt(user.role, user.flags) || !user.chatQuota) {
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
    rawHistoryRef.current = null;
    setTokenUsage(null);
    setToolStatus(null);
    setInput("");
    setIsStreaming(false);
    setSessionId(crypto.randomUUID());
    inputRef.current?.focus();
  }, [cancelStream]);

  const canStartNewChat =
    messages.length > 0 || isStreaming || rawHistory != null;

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

    const currentRawHistory = rawHistoryRef.current;
    try {
      await streamChat(
        {
          message: text,
          rawHistory: currentRawHistory ?? undefined,
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
                setRawHistory(event.rawHistory);
                rawHistoryRef.current = event.rawHistory;
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
    serverContext,
    sessionId,
    quotaExceeded,
    chatQuota,
  ]);

  return {
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
  };
}
