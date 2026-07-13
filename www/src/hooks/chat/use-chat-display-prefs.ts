import {
  localStorageJsonOptions,
  useLocalStorage,
} from "@/hooks/use-local-storage";

import type { ChatDisplayPrefs } from "@/components/chat/lib/types";

const CHAT_DISPLAY_PREFS_STORAGE_KEY = "chat-display-prefs";

const DEFAULT_CHAT_DISPLAY_PREFS: ChatDisplayPrefs = {
  showToolCalls: true,
  showReasoning: true,
};

function parseChatDisplayPrefs(raw: unknown): ChatDisplayPrefs | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const { showToolCalls, showReasoning } = raw as Record<string, unknown>;
  if (typeof showToolCalls !== "boolean" || typeof showReasoning !== "boolean") {
    return null;
  }

  return { showToolCalls, showReasoning };
}

export function useChatDisplayPrefs() {
  const [prefs, setPrefs] = useLocalStorage(CHAT_DISPLAY_PREFS_STORAGE_KEY, {
    defaultValue: DEFAULT_CHAT_DISPLAY_PREFS,
    ...localStorageJsonOptions(parseChatDisplayPrefs),
  });

  const setShowToolCalls = (showToolCalls: boolean) => {
    setPrefs((current) => ({ ...current, showToolCalls }));
  };

  const setShowReasoning = (showReasoning: boolean) => {
    setPrefs((current) => ({ ...current, showReasoning }));
  };

  return {
    prefs,
    setShowToolCalls,
    setShowReasoning,
  };
}
