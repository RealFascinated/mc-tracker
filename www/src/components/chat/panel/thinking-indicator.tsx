import { useEffect, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";

import { THINKING_MESSAGES } from "@/components/chat/lib/constants";

export function ThinkingIndicator() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % THINKING_MESSAGES.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="text-muted-foreground inline-flex items-center gap-2 text-xs shimmer">
      <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" />
      {THINKING_MESSAGES[messageIndex]}
    </span>
  );
}
