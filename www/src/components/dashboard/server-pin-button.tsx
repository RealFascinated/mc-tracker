import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { pinServer, unpinServer } from "@/lib/api/pinned-servers";
import { pinnedServersQueryKey } from "@/lib/api/pinned-servers.queries";
import { cn } from "cnfast";

type ServerPinButtonProps = {
  serverId: string;
  isPinned: boolean;
  className?: string;
};

export function ServerPinButton({
  serverId,
  isPinned,
  className,
}: ServerPinButtonProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => (isPinned ? unpinServer(serverId) : pinServer(serverId)),
    onSuccess: (data) => {
      queryClient.setQueryData(pinnedServersQueryKey, data);
      toast.success(isPinned ? "Server unpinned" : "Server pinned");
    },
    onError: () => {
      toast.error(isPinned ? "Failed to unpin server" : "Failed to pin server");
    },
  });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("shrink-0", className)}
      aria-label={isPinned ? "Unpin server" : "Pin server"}
      aria-pressed={isPinned}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {isPinned ? (
        <PinOff className="size-4" aria-hidden />
      ) : (
        <Pin className="size-4" aria-hidden />
      )}
    </Button>
  );
}
