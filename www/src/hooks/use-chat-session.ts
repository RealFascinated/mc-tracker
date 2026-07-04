import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ChatSessionTurn, ChatTokenUsage } from "@/lib/api/chat";
import { ChatStreamError, streamChat } from "@/lib/api/chat";
import { useAuth } from "@/lib/auth/context";
import type { ChatQuota } from "@/lib/auth/types";
import { chatQuotaExempt } from "@/lib/user-flags";

import { STREAMING_ID } from "@/components/chat/chat-types";
import type { ChatMessage } from "@/components/chat/chat-types";
import { toolStatusLabel } from "@/components/chat/chat-utils";
import { useChatServerContext } from "@/hooks/use-chat-server-context";

export function useChatSession() {
  const { user, refreshUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<ChatTokenUsage | null>(null);
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);
  const [truncatedNotice, setTruncatedNotice] = useState(false);
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
    const controller = abortRef.current;
    if (!controller) {
      return;
    }
    controller.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setToolStatus(null);
    setMessages((current) => {
      const streaming = current.find((message) => message.id === STREAMING_ID);
      if (!streaming) {
        return current;
      }
      const hasContent =
        streaming.content.trim().length > 0 ||
        (streaming.toolCalls?.length ?? 0) > 0;
      const withoutStreaming = current.filter(
        (message) => message.id !== STREAMING_ID,
      );
      if (!hasContent) {
        return withoutStreaming;
      }
      return [
        ...withoutStreaming,
        { ...streaming, id: crypto.randomUUID() },
      ];
    });
  }, []);

  const startNewChat = useCallback(() => {
    cancelStream();
    setMessages([]);
    setTokenUsage(null);
    setToolStatus(null);
    setInput("");
    setIsStreaming(false);
    setTruncatedNotice(false);
    setSessionId(crypto.randomUUID());
    inputRef.current?.focus();
  }, [cancelStream]);

  const loadSession = useCallback(
    (id: string, turns: ChatSessionTurn[]) => {
      cancelStream();
      setSessionId(id);
      setTruncatedNotice(false);
      setMessages(
        turns.map((turn) => ({
          id: crypto.randomUUID(),
          role: turn.role,
          content: turn.content,
          toolCalls:
            turn.toolNames && turn.toolNames.length > 0
              ? turn.toolNames
              : undefined,
        })),
      );
      setTokenUsage(null);
      setToolStatus(null);
      setInput("");
      setIsStreaming(false);
    },
    [cancelStream],
  );

  const canStartNewChat = messages.length > 0 || isStreaming;

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
    setTruncatedNotice(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        {
          message: text,
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
              if (event.truncated) {
                setTruncatedNotice(true);
              }
              if (event.usage) {
                setTokenUsage(event.usage);
              }
              if (event.quotaUsed !== undefined && chatQuota) {
                setQuotaUsed((current) =>
                  current !== null ? current + event.quotaUsed! : chatQuota.used + event.quotaUsed!,
                );
              } else if (chatQuota) {
                void refreshUser();
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
    refreshUser,
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
    sessionId,
    truncatedNotice,
    inputRef,
    pickSuggestion,
    cancelStream,
    startNewChat,
    loadSession,
    canStartNewChat,
    sendMessage,
  };
}
