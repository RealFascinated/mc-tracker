import { MessageCircleIcon } from "lucide-react";

import {
  DEFAULT_SUGGESTIONS,
  serverSuggestions,
} from "@/components/chat/chat-constants";

export function ChatSuggestions({
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
