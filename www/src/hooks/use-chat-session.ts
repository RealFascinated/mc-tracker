import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ChatSessionTurn, ChatTokenUsage } from "@/lib/api/chat";
import { ChatStreamError, streamChat } from "@/lib/api/chat";
import { useAuth } from "@/lib/auth/context";
import type { ChatQuota } from "@/lib/auth/types";
import { chatQuotaExempt } from "@/lib/user-flags";

import { STREAMING_ID } from "@/components/chat/chat-types";
import type { ChatMessage, ChatPart } from "@/components/chat/chat-types";
import {
  appendReasoningDelta,
  appendTextDelta,
  appendToolStart,
  assistantHasVisibleContent,
  assistantTextFromParts,
  finalizeParts,
  markToolDone,
  turnsToAssistantParts,
} from "@/components/chat/chat-part-utils";
import { useChatServerContext } from "@/hooks/use-chat-server-context";

function updateStreamingMessage(
  current: ChatMessage[],
  updater: (parts: ChatPart[]) => ChatPart[],
): ChatMessage[] {
  return current.map((message) => {
    if (message.id !== STREAMING_ID) {
      return message;
    }
    const parts = updater(message.parts ?? []);
    return {
      ...message,
      parts,
      content: assistantTextFromParts(parts),
    };
  });
}

export function useChatSession() {
  const { user, refreshUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [isStreaming, setIsStreaming] = useState(false);
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
    setMessages((current) => {
      const streaming = current.find((message) => message.id === STREAMING_ID);
      if (!streaming) {
        return current;
      }
      const withoutStreaming = current.filter(
        (message) => message.id !== STREAMING_ID,
      );
      if (!assistantHasVisibleContent(streaming)) {
        return withoutStreaming;
      }
      const parts = finalizeParts(streaming.parts ?? []);
      return [
        ...withoutStreaming,
        {
          ...streaming,
          id: crypto.randomUUID(),
          parts,
          content: assistantTextFromParts(parts) || streaming.content,
        },
      ];
    });
  }, []);

  const startNewChat = useCallback(() => {
    cancelStream();
    setMessages([]);
    setTokenUsage(null);
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
        turns.map((turn) => {
          if (turn.role === "user") {
            return {
              id: crypto.randomUUID(),
              role: turn.role,
              content: turn.content,
            };
          }
          const parts = turnsToAssistantParts(turn.content, turn.toolNames);
          return {
            id: crypto.randomUUID(),
            role: turn.role,
            content: turn.content,
            parts: parts.length > 0 ? parts : undefined,
          };
        }),
      );
      setTokenUsage(null);
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
      { id: STREAMING_ID, role: "assistant" as const, content: "", parts: [] },
    ];
    setMessages(nextMessages);
    setInput("");
    setIsStreaming(true);
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
              setMessages((current) =>
                updateStreamingMessage(current, (parts) =>
                  appendToolStart(parts, event.name),
                ),
              );
              break;
            case "toolDone":
              setMessages((current) =>
                updateStreamingMessage(current, (parts) =>
                  markToolDone(parts, event.name),
                ),
              );
              break;
            case "delta":
              setMessages((current) =>
                updateStreamingMessage(current, (parts) =>
                  appendTextDelta(parts, event.content),
                ),
              );
              break;
            case "reasoningDelta":
              setMessages((current) =>
                updateStreamingMessage(current, (parts) =>
                  appendReasoningDelta(parts, event.content),
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
                  current !== null
                    ? current + event.quotaUsed!
                    : chatQuota.used + event.quotaUsed!,
                );
              } else if (chatQuota) {
                void refreshUser();
              }
              setMessages((current) =>
                current.map((message) => {
                  if (message.id !== STREAMING_ID) {
                    return message;
                  }
                  let parts = finalizeParts(message.parts ?? []);
                  const streamedTools = new Set(
                    parts
                      .filter((part) => part.kind === "tool")
                      .map((part) => part.name),
                  );
                  for (const tool of event.toolCalls ?? []) {
                    if (!streamedTools.has(tool.name)) {
                      parts = [
                        ...parts,
                        {
                          id: crypto.randomUUID(),
                          kind: "tool",
                          name: tool.name,
                          status: "done",
                        },
                      ];
                    }
                  }
                  return {
                    ...message,
                    id: crypto.randomUUID(),
                    parts,
                    content: assistantTextFromParts(parts),
                  };
                }),
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
        current.filter((message) => message.id !== STREAMING_ID),
      );
    } finally {
      setIsStreaming(false);
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
