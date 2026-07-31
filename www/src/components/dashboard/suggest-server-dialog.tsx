import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";
import { toast } from "sonner";

import { AdminServerFormFields } from "@/components/admin/servers/form-fields";
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
import { errorMessage } from "@/lib/api/error-message";
import { myServerSuggestionsQueryKey } from "@/lib/api/server-suggestions.queries";
import { submitServerSuggestion } from "@/lib/api/server-suggestions";
import { formatPlayers } from "@/lib/formatter";
import { lookupMcutilsServer } from "@/lib/mcutils/lookup-server";
import type { McutilsServer } from "@/lib/mcutils/lookup-server";

const emptyForm: CreateServerRequest = {
  name: "",
  host: "",
  port: null,
  type: "PC",
};

type LookupState =
  | { kind: "confirm"; body: CreateServerRequest; server: McutilsServer }
  | { kind: "error"; message: string };

type SuggestDialogState = {
  form: CreateServerRequest;
  lookup: LookupState | null;
  isChecking: boolean;
};

type SuggestDialogAction =
  | { type: "set_form"; form: CreateServerRequest }
  | { type: "set_lookup"; state: LookupState | null }
  | { type: "set_checking"; checking: boolean }
  | { type: "reset" };

function suggestDialogReducer(
  state: SuggestDialogState,
  action: SuggestDialogAction,
): SuggestDialogState {
  switch (action.type) {
    case "set_form":
      return { ...state, form: action.form };
    case "set_lookup":
      return { ...state, lookup: action.state };
    case "set_checking":
      return { ...state, isChecking: action.checking };
    case "reset":
      return { form: emptyForm, lookup: null, isChecking: false };
    default:
      return state;
  }
}

type SuggestServerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
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

function SuggestServerDialog({
  open,
  onOpenChange,
  onSubmitted,
}: SuggestServerDialogProps) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(suggestDialogReducer, {
    form: emptyForm,
    lookup: null,
    isChecking: false,
  });

  const submitMutation = useMutation({
    mutationFn: submitServerSuggestion,
    onSuccess: async () => {
      toast.success("Server suggestion submitted for review");
      onOpenChange(false);
      dispatch({ type: "reset" });
      await queryClient.invalidateQueries({
        queryKey: myServerSuggestionsQueryKey,
      });
      onSubmitted?.();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function handleClose(openChange: boolean) {
    if (!openChange) {
      onOpenChange(false);
      dispatch({ type: "reset" });
    }
  }

  async function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: CreateServerRequest = {
      name: state.form.name.trim(),
      host: state.form.host.trim(),
      port: state.form.port,
      type: state.form.type,
    };

    dispatch({ type: "set_checking", checking: true });
    try {
      const { server, error } = await lookupMcutilsServer(body);
      if (error || !server) {
        dispatch({
          type: "set_lookup",
          state: {
            kind: "error",
            message: error?.message ?? "Server is offline or unreachable.",
          },
        });
        return;
      }
      dispatch({
        type: "set_lookup",
        state: { kind: "confirm", body, server },
      });
    } catch (err) {
      dispatch({
        type: "set_lookup",
        state: { kind: "error", message: errorMessage(err) },
      });
    } finally {
      dispatch({ type: "set_checking", checking: false });
    }
  }

  function handleConfirm() {
    if (state.lookup?.kind !== "confirm") {
      return;
    }
    submitMutation.mutate({
      name: state.lookup.body.name,
      host: state.lookup.body.host,
      port: state.lookup.body.port,
      type: state.lookup.body.type,
    });
  }

  const confirmServer =
    state.lookup?.kind === "confirm" ? state.lookup.server : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton>
        {state.lookup?.kind === "error" ? (
          <>
            <DialogHeader>
              <DialogTitle>Server offline</DialogTitle>
              <DialogDescription>{state.lookup.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => dispatch({ type: "set_lookup", state: null })}
              >
                Back
              </Button>
            </DialogFooter>
          </>
        ) : state.lookup?.kind === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Is this the correct server?</DialogTitle>
              <DialogDescription>
                We reached this server at the address you entered. Confirm to
                submit it for review.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 rounded-soft border border-border bg-muted/30 p-3">
              <ServerFavicon
                name={confirmServer?.registryEntry?.displayName ?? ""}
                favicon={serverFaviconUrl(confirmServer!)}
                size="md"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {confirmServer!.registryEntry?.displayName ??
                    confirmServer!.hostname}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {formatServerHost(
                    confirmServer!.hostname,
                    confirmServer!.port,
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPlayers(confirmServer!.players.online)} /{" "}
                  {formatPlayers(confirmServer!.players.max)} players online
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={submitMutation.isPending}
                onClick={() => dispatch({ type: "set_lookup", state: null })}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="brand"
                disabled={submitMutation.isPending}
                onClick={handleConfirm}
              >
                {submitMutation.isPending ? "Submitting…" : "Submit for review"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Suggest a server</DialogTitle>
              <DialogDescription>
                Suggest a Minecraft server to be tracked. An administrator will
                review your suggestion.
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={handleLookup}>
              <div className="app-shell-form-grid">
                <AdminServerFormFields
                  idPrefix="suggest"
                  values={state.form}
                  onChange={(form) => dispatch({ type: "set_form", form })}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  disabled={state.isChecking}
                >
                  {state.isChecking ? "Checking…" : "Check server"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { SuggestServerDialog };
