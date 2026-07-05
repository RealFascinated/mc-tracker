import { useQuery } from "@tanstack/react-query";
import { HistoryIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteChatSession,
  fetchChatSession,
  fetchChatSessions,
} from "@/lib/api/chat";
import { errorMessage } from "@/lib/api/error-message";
import { cn } from "cnfast";

type ChatHistorySheetProps = {
  onLoadSession: (
    sessionId: string,
    turns: Awaited<ReturnType<typeof fetchChatSession>>["turns"],
    sessionUsage: Pick<
      Awaited<ReturnType<typeof fetchChatSession>>,
      "tokensUsed" | "lastPromptTokens" | "contextMax"
    >,
  ) => void;
};

export function ChatHistorySheet({ onLoadSession }: ChatHistorySheetProps) {
  const [open, setOpen] = useState(false);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: fetchChatSessions,
    enabled: open,
  });

  async function handleSelect(sessionId: string) {
    try {
      const detail = await fetchChatSession(sessionId);
      onLoadSession(detail.sessionId, detail.turns, {
        tokensUsed: detail.tokensUsed,
        lastPromptTokens: detail.lastPromptTokens,
        contextMax: detail.contextMax,
      });
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleDelete(sessionId: string) {
    try {
      await deleteChatSession(sessionId);
      await refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Chat history"
        onClick={() => setOpen(true)}
      >
        <HistoryIcon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(32rem,85vh)] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chat history</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {isPending ? (
              <p className="text-muted-foreground px-1 text-sm">Loading…</p>
            ) : null}
            {isError ? (
              <p className="text-destructive px-1 text-sm">
                Failed to load history.
              </p>
            ) : null}
            {data?.sessions.length === 0 ? (
              <p className="text-muted-foreground px-1 text-sm">
                No past conversations yet.
              </p>
            ) : null}
            <ul className="flex flex-col gap-1">
              {data?.sessions.map((session) => (
                <li key={session.sessionId}>
                  <div className="flex items-stretch gap-1">
                    <button
                      type="button"
                      className={cn(
                        "hover:bg-muted flex min-w-0 flex-1 flex-col rounded-md px-3 py-2 text-left",
                      )}
                      onClick={() => void handleSelect(session.sessionId)}
                    >
                      <span className="truncate text-sm font-medium">
                        {session.preview}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(session.updatedAt).toLocaleString()}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground shrink-0"
                      onClick={() => void handleDelete(session.sessionId)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
