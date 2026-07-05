import { ServerFavicon } from "@/components/dashboard/server/favicon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CreateServerRequest } from "@/lib/api/admin/servers";
import { formatServerHost } from "@/lib/api/servers";
import { formatPlayers } from "@/lib/formatter";
import type { McutilsServer } from "@/lib/mcutils/lookup-server";

export type AddServerLookupState =
  | {
      kind: "confirm";
      body: CreateServerRequest;
      server: McutilsServer;
    }
  | {
      kind: "error";
      message: string;
    };

type AddServerLookupDialogProps = {
  state: AddServerLookupState | null;
  isAdding: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function serverFaviconUrl(server: McutilsServer): string | null {
  if ("favicon" in server && server.favicon) {
    if (server.favicon.url) {
      return server.favicon.url;
    }
    if (server.favicon.base64) {
      return `data:image/png;base64,${server.favicon.base64}`;
    }
  }
  return null;
}

function serverVersionLabel(server: McutilsServer): string | null {
  if ("version" in server && server.version.name) {
    return server.version.name;
  }
  return null;
}

function serverLocationLabel(server: McutilsServer): string | null {
  if (!server.location) {
    return null;
  }
  const parts = [server.location.city, server.location.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function ServerLookupDetails({ server }: { server: McutilsServer }) {
  const displayName = server.registryEntry?.displayName ?? server.hostname;
  const version = serverVersionLabel(server);
  const location = serverLocationLabel(server);

  return (
    <div className="flex gap-3 rounded-soft border border-border bg-muted/30 p-3">
      <ServerFavicon
        name={displayName}
        favicon={serverFaviconUrl(server)}
        size="md"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="truncate text-sm font-semibold text-foreground">
            {displayName}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {formatServerHost(server.hostname, server.port)}
          </p>
        </div>
        {server.motd.preview ? (
          <p className="text-sm text-foreground">{server.motd.preview}</p>
        ) : null}
        <dl className="grid gap-1 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Players</dt>
            <dd className="font-medium text-foreground">
              {formatPlayers(server.players.online)} /{" "}
              {formatPlayers(server.players.max)}
            </dd>
          </div>
          {version ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Version</dt>
              <dd className="truncate font-medium text-foreground">
                {version}
              </dd>
            </div>
          ) : null}
          {location ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="truncate font-medium text-foreground">
                {location}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

function AddServerLookupDialog({
  state,
  isAdding,
  onClose,
  onConfirm,
}: AddServerLookupDialogProps) {
  if (!state) {
    return null;
  }

  if (state.kind === "error") {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Server offline</DialogTitle>
            <DialogDescription>{state.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isAdding && onClose()}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Is this the correct server?</DialogTitle>
          <DialogDescription>
            We reached this server at the address you entered. Confirm before
            adding it to tracking.
          </DialogDescription>
        </DialogHeader>
        <ServerLookupDetails server={state.server} />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isAdding}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="brand"
            disabled={isAdding}
            onClick={onConfirm}
          >
            {isAdding ? "Adding…" : "Yes, add server"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { AddServerLookupDialog };
