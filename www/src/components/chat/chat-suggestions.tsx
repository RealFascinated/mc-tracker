import { useEffect, useMemo, useState } from "react";
import { MessageCircleIcon } from "lucide-react";

import {
  DEFAULT_SUGGESTIONS,
  pickRotatingSuggestions,
  serverSuggestions,
} from "@/components/chat/chat-constants";

const EMPTY_SUGGESTION_COUNT = 4;
const FOLLOW_UP_SUGGESTION_COUNT = 3;

export function ChatSuggestions({
  disabled,
  onPick,
  rotationKey,
  serverName,
  variant = "empty",
}: {
  disabled: boolean;
  onPick: (text: string) => void;
  rotationKey: string;
  serverName?: string;
  variant?: "empty" | "follow-up";
}) {
  const allSuggestions = useMemo(
    () =>
      serverName ? serverSuggestions(serverName) : [...DEFAULT_SUGGESTIONS],
    [serverName],
  );
  const isFollowUp = variant === "follow-up";
  const visibleCount = isFollowUp
    ? FOLLOW_UP_SUGGESTION_COUNT
    : EMPTY_SUGGESTION_COUNT;
  const [offset, setOffset] = useState(() =>
    Math.floor(Math.random() * allSuggestions.length),
  );

  useEffect(() => {
    setOffset(Math.floor(Math.random() * allSuggestions.length));
  }, [rotationKey, allSuggestions.length]);

  const suggestions = useMemo(
    () => pickRotatingSuggestions(allSuggestions, visibleCount, offset),
    [allSuggestions, visibleCount, offset],
  );
  const chips = suggestions.map((suggestion, index) => (
    <button
      key={`${offset}-${index}-${suggestion}`}
      type="button"
      disabled={disabled}
      onClick={() => onPick(suggestion)}
      className="rounded-soft border border-border bg-card px-3 py-1.5 text-center text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      {suggestion}
    </button>
  ));

  if (isFollowUp) {
    return <div className="flex flex-wrap gap-2">{chips}</div>;
  }

  return (
    <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
      <MessageCircleIcon className="text-muted-foreground size-8 stroke-1" />
      <p className="text-sm font-medium text-foreground">
        {serverName ? `Ask about ${serverName}` : "Ask about tracked servers"}
      </p>
      <div className="flex flex-wrap justify-center gap-2">{chips}</div>
    </div>
  );
}
