import { useMemo, useState } from "react";
import { MessageCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_SUGGESTIONS,
  pickRotatingSuggestions,
  serverSuggestions,
} from "@/components/chat/lib/constants";

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
  const [offset] = useState(() =>
    Math.floor(Math.random() * allSuggestions.length),
  );

  const suggestions = useMemo(
    () => pickRotatingSuggestions(allSuggestions, visibleCount, offset),
    [allSuggestions, visibleCount, offset],
  );
  const chips = suggestions.map((suggestion, index) => (
    <Button
      key={`${rotationKey}-${offset}-${index}-${suggestion}`}
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => onPick(suggestion)}
      className="h-auto whitespace-normal rounded-soft border-border bg-card px-3 py-1.5 text-center text-xs font-normal hover:bg-muted dark:border-border dark:bg-card dark:hover:bg-muted"
    >
      {suggestion}
    </Button>
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
