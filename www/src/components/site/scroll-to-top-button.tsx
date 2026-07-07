import { useSyncExternalStore } from "react";
import { ArrowUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "cnfast";

const SCROLL_THRESHOLD = 240;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("scroll", onStoreChange, { passive: true });
  return () => window.removeEventListener("scroll", onStoreChange);
}

function getScrollVisible() {
  return window.scrollY > SCROLL_THRESHOLD;
}

export function ScrollToTopButton() {
  const visible = useSyncExternalStore(
    subscribe,
    getScrollVisible,
    () => false,
  );

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      className={cn(
        "fixed right-4 bottom-[calc(1rem+3rem+0.5rem)] z-50 size-12 rounded-full border-border bg-card text-foreground shadow-lg ring-2 ring-background transition-[opacity,transform] hover:bg-card-hover dark:border-border dark:bg-card dark:hover:bg-card-hover",
        !visible && "pointer-events-none scale-0 opacity-0",
      )}
      aria-label="Scroll to top"
      aria-hidden={!visible}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUpIcon className="size-5" />
    </Button>
  );
}
