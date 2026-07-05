import { useQuery } from "@tanstack/react-query";
import { HistoryIcon, MessageSquareTextIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  deleteChatSession,
  fetchChatSession,
  fetchChatSessions,
} from "@/lib/api/chat";
import { errorMessage } from "@/lib/api/error-message";
import { formatTimeAgo } from "@/lib/formatter";
import { cn } from "cnfast";

type PendingDelete = {
  sessionId: string;
  preview: string;
};

type ChatHistorySheetProps = {
  activeSessionId: string;
  onLoadSession: (
    sessionId: string,
    turns: Awaited<ReturnType<typeof fetchChatSession>>["turns"],
    sessionUsage: Pick<
      Awaited<ReturnType<typeof fetchChatSession>>,
      "tokensUsed" | "lastPromptTokens" | "contextMax"
    >,
  ) => void;
  onDeleteActiveSession: () => void;
};

function HistoryLoadingSkeleton() {
  return (
    <ul className="flex flex-col gap-2.5" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <li
          key={index}
          className="flex gap-3 rounded-soft border border-border px-4 py-3.5"
        >
          <Skeleton className="size-9 shrink-0 rounded-soft" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
            <Skeleton className="h-3.5 w-4/5 rounded-sm" />
            <Skeleton className="h-3 w-1/3 rounded-sm" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ChatHistorySheet({
  activeSessionId,
  onLoadSession,
  onDeleteActiveSession,
}: ChatHistorySheetProps) {
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: fetchChatSessions,
    enabled: open,
  });

  const sessionCount = data?.sessions.length ?? 0;

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

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    try {
      await deleteChatSession(pendingDelete.sessionId);
      if (pendingDelete.sessionId === activeSessionId) {
        onDeleteActiveSession();
      }
      setPendingDelete(null);
      await refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Chat history"
            onClick={() => setOpen(true)}
          >
            <HistoryIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Chat history
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(42rem,88vh)] min-h-[min(24rem,70vh)] w-[calc(100%-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
            <DialogTitle>Chat history</DialogTitle>
            <DialogDescription>
              {isPending
                ? "Loading your conversations…"
                : sessionCount > 0
                  ? `${sessionCount} saved conversation${sessionCount === 1 ? "" : "s"}`
                  : "Resume a past conversation or start a new one."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {isPending ? <HistoryLoadingSkeleton /> : null}
            {isError ? (
              <Alert variant="destructive" className="rounded-soft">
                <AlertTitle>Failed to load history</AlertTitle>
                <AlertDescription>
                  Check your connection and try again.
                </AlertDescription>
              </Alert>
            ) : null}
            {!isPending && !isError && sessionCount === 0 ? (
              <Empty className="rounded-soft border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia>
                    <MessageSquareTextIcon className="text-muted-foreground size-10 stroke-1" />
                  </EmptyMedia>
                  <EmptyTitle>No conversations yet</EmptyTitle>
                  <EmptyDescription>
                    Chats you finish will show up here so you can pick up where
                    you left off.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            {!isPending && !isError && sessionCount > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {data.sessions.map((session) => {
                  const isActive = session.sessionId === activeSessionId;

                  return (
                    <li key={session.sessionId}>
                      <div
                        className={cn(
                          "group relative flex items-stretch gap-2 rounded-soft border transition-colors",
                          isActive
                            ? "border-primary/50 bg-primary/8 shadow-sm"
                            : "border-border bg-card hover:border-border/80 hover:bg-muted/35",
                        )}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 pr-12 text-left"
                          onClick={() => void handleSelect(session.sessionId)}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-soft border",
                              isActive
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border bg-muted/50 text-muted-foreground",
                            )}
                          >
                            <MessageSquareTextIcon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm leading-snug font-medium text-foreground">
                              {session.preview}
                            </span>
                            <span className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                              <time dateTime={session.updatedAt}>
                                {formatTimeAgo(session.updatedAt)}
                              </time>
                              {isActive ? (
                                <Badge className="h-5 rounded-full px-2 text-[10px] font-semibold tracking-wide uppercase">
                                  Current
                                </Badge>
                              ) : null}
                            </span>
                          </span>
                        </button>
                        <div className="absolute top-2 right-2 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-8"
                                aria-label={`Delete conversation: ${session.preview}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setPendingDelete({
                                    sessionId: session.sessionId,
                                    preview: session.preview,
                                  });
                                }}
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" sideOffset={6}>
                              Delete
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleting) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-soft sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (
                <>
                  <span className="text-foreground font-medium">
                    {pendingDelete.preview}
                  </span>{" "}
                  will be permanently removed. This cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
