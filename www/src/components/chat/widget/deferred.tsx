import { lazy, Suspense, useState } from "react";
import { MessageCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "cnfast";

const TrackerChatWidget = lazy(() =>
  import("@/components/chat/widget/widget").then((mod) => ({
    default: mod.TrackerChatWidget,
  })),
);

/**
 * The chat bundle (markdown rendering, session state) only loads after the
 * user actually opens the chat — never for visitors who don't interact.
 */
export function DeferredChatWidget() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="brand"
        size="icon-lg"
        className={cn(
          "fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg ring-2 ring-background transition-all duration-200",
        )}
        aria-label="Open chat"
        onClick={() => setOpen(true)}
      >
        <MessageCircleIcon className="size-5" />
      </Button>
    );
  }

  // Stays mounted after the first open so the chat session survives close.
  return (
    <Suspense fallback={null}>
      <TrackerChatWidget open onClose={() => setOpen(false)} />
    </Suspense>
  );
}
