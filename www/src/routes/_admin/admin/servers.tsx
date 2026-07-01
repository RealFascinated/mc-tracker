import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";
import { toast } from "sonner";

import {
  AddServerLookupDialog
  
} from "@/components/admin/add-server-lookup-dialog";
import type {AddServerLookupState} from "@/components/admin/add-server-lookup-dialog";
import { AdminServerFormFields } from "@/components/admin/admin-server-form-fields";
import { AdminServersTable } from "@/components/admin/admin-servers-table";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createAdminServer,
  deleteAdminServer,
  updateAdminServer,
} from "@/lib/api/admin/servers";
import type { AdminServer, CreateServerRequest } from "@/lib/api/admin/servers";
import {
  adminServersQueryKey,
  adminServersQueryOptions,
} from "@/lib/api/admin/servers.queries";
import { errorMessage } from "@/lib/api/error-message";
import { lookupMcutilsServer } from "@/lib/mcutils/lookup-server";
import { pageTitle } from "@/lib/page-title";
import { privatePageHead } from "@/lib/embed-meta";

export const Route = createFileRoute("/_admin/admin/servers")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminServersQueryOptions()),
  head: () => privatePageHead(pageTitle("Admin servers")),
  component: AdminServersPage,
});

const emptyForm: CreateServerRequest = {
  name: "",
  host: "",
  port: null,
  type: "PC",
};

function serverToForm(server: AdminServer): CreateServerRequest {
  return {
    name: server.name,
    host: server.host,
    port: server.port,
    type: server.type,
  };
}

type EditServerState = {
  target: AdminServer;
  form: CreateServerRequest;
};

type AdminServersUiState = {
  form: CreateServerRequest;
  editState: EditServerState | null;
  deleteTarget: AdminServer | null;
  lookupState: AddServerLookupState | null;
  isCheckingServer: boolean;
};

type AdminServersUiAction =
  | { type: "set_form"; form: CreateServerRequest }
  | { type: "reset_form" }
  | { type: "open_edit"; target: AdminServer; form: CreateServerRequest }
  | { type: "close_edit" }
  | { type: "update_edit_form"; form: CreateServerRequest }
  | { type: "set_delete_target"; target: AdminServer | null }
  | { type: "set_lookup_state"; state: AddServerLookupState | null }
  | { type: "set_checking_server"; checking: boolean };

function adminServersUiReducer(
  state: AdminServersUiState,
  action: AdminServersUiAction,
): AdminServersUiState {
  switch (action.type) {
    case "set_form":
      return { ...state, form: action.form };
    case "reset_form":
      return { ...state, form: emptyForm };
    case "open_edit":
      return {
        ...state,
        editState: { target: action.target, form: action.form },
      };
    case "close_edit":
      return { ...state, editState: null };
    case "update_edit_form":
      return state.editState
        ? { ...state, editState: { ...state.editState, form: action.form } }
        : state;
    case "set_delete_target":
      return { ...state, deleteTarget: action.target };
    case "set_lookup_state":
      return { ...state, lookupState: action.state };
    case "set_checking_server":
      return { ...state, isCheckingServer: action.checking };
    default:
      return state;
  }
}

function AdminServersPage() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminServersQueryOptions());
  const [ui, dispatch] = useReducer(adminServersUiReducer, {
    form: emptyForm,
    editState: null,
    deleteTarget: null,
    lookupState: null,
    isCheckingServer: false,
  });

  const createMutation = useMutation({
    mutationFn: createAdminServer,
    onSuccess: async () => {
      toast.success("Server added");
      dispatch({ type: "reset_form" });
      dispatch({ type: "set_lookup_state", state: null });
      await queryClient.invalidateQueries({ queryKey: adminServersQueryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CreateServerRequest }) =>
      updateAdminServer(id, {
        name: body.name.trim(),
        host: body.host.trim(),
        port: body.port,
        type: body.type,
      }),
    onSuccess: async () => {
      toast.success("Server updated");
      dispatch({ type: "close_edit" });
      await queryClient.invalidateQueries({ queryKey: adminServersQueryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const pauseMutation = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      updateAdminServer(id, { paused }),
    onSuccess: async (_data, { paused }) => {
      toast.success(paused ? "Tracking paused" : "Tracking resumed");
      await queryClient.invalidateQueries({ queryKey: adminServersQueryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminServer,
    onSuccess: async () => {
      toast.success("Server removed");
      dispatch({ type: "set_delete_target", target: null });
      await queryClient.invalidateQueries({ queryKey: adminServersQueryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isPending) {
    return <LoadingState message="Loading servers…" />;
  }

  if (!data) {
    return <p className="text-destructive">Failed to load servers.</p>;
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: CreateServerRequest = {
      name: ui.form.name.trim(),
      host: ui.form.host.trim(),
      port: ui.form.port,
      type: ui.form.type,
    };

    dispatch({ type: "set_checking_server", checking: true });
    try {
      const { server, error } = await lookupMcutilsServer(body);
      if (error || !server) {
        dispatch({
          type: "set_lookup_state",
          state: {
            kind: "error",
            message: error?.message ?? "Server is offline or unreachable.",
          },
        });
        return;
      }
      dispatch({
        type: "set_lookup_state",
        state: { kind: "confirm", body, server },
      });
    } catch (err) {
      dispatch({
        type: "set_lookup_state",
        state: {
          kind: "error",
          message: errorMessage(err),
        },
      });
    } finally {
      dispatch({ type: "set_checking_server", checking: false });
    }
  }

  function handleConfirmCreate() {
    if (ui.lookupState?.kind !== "confirm") {
      return;
    }
    createMutation.mutate(ui.lookupState.body);
  }

  function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ui.editState) {
      return;
    }
    updateMutation.mutate({
      id: ui.editState.target.id,
      body: ui.editState.form,
    });
  }

  const activeCount = data.servers.filter((server) => !server.paused).length;
  const pausedCount = data.servers.length - activeCount;

  return (
    <>
      <PageHeader
        title="Servers"
        description="Add and manage Minecraft servers tracked by this instance."
      />

      <div className="flex flex-col gap-6">
        <section className="app-shell-section">
          <div className="app-shell-section-header">
            <h2 className="app-shell-section-title">Add server</h2>
            <p className="app-shell-section-description">
              Track a Java (PC) or Bedrock (PE) Minecraft server.
            </p>
          </div>
          <div className="app-shell-section-body">
            <form className="app-shell-form-grid" onSubmit={handleCreate}>
              <AdminServerFormFields
                idPrefix="create"
                values={ui.form}
                onChange={(form) => dispatch({ type: "set_form", form })}
              />
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  variant="brand"
                  disabled={ui.isCheckingServer || createMutation.isPending}
                >
                  {ui.isCheckingServer
                    ? "Checking…"
                    : createMutation.isPending
                      ? "Adding…"
                      : "Add server"}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section className="app-shell-section">
          <div className="app-shell-section-header">
            <h2 className="app-shell-section-title">Tracked servers</h2>
            <p className="app-shell-section-description">
              {activeCount} active
              {pausedCount > 0 ? `, ${pausedCount} paused` : ""} of{" "}
              {data.servers.length} configured server
              {data.servers.length === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="app-shell-section-body">
            <AdminServersTable
              servers={data.servers}
              onEdit={(server) =>
                dispatch({
                  type: "open_edit",
                  target: server,
                  form: serverToForm(server),
                })
              }
              onPauseChange={(server, paused) =>
                pauseMutation.mutate({ id: server.id, paused })
              }
              onDelete={(target) =>
                dispatch({ type: "set_delete_target", target })
              }
            />
          </div>
        </section>
      </div>

      <AddServerLookupDialog
        state={ui.lookupState}
        isAdding={createMutation.isPending}
        onClose={() => dispatch({ type: "set_lookup_state", state: null })}
        onConfirm={handleConfirmCreate}
      />

      <Dialog
        open={ui.editState != null}
        onOpenChange={(open) => {
          if (!open) {
            dispatch({ type: "close_edit" });
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Edit server</DialogTitle>
            <DialogDescription>
              {ui.editState
                ? `Update connection details for "${ui.editState.target.name}".`
                : null}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleEdit}>
            <AdminServerFormFields
              idPrefix="edit"
              values={ui.editState?.form ?? emptyForm}
              onChange={(form) => dispatch({ type: "update_edit_form", form })}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => dispatch({ type: "close_edit" })}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="brand"
                disabled={updateMutation.isPending || !ui.editState}
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ui.deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            dispatch({ type: "set_delete_target", target: null });
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete server?</DialogTitle>
            <DialogDescription>
              {ui.deleteTarget
                ? `This removes "${ui.deleteTarget.name}" permanently. Pause tracking instead to keep the server configured without pings.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                dispatch({ type: "set_delete_target", target: null })
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending || !ui.deleteTarget}
              onClick={() => {
                if (ui.deleteTarget) {
                  deleteMutation.mutate(ui.deleteTarget.id);
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
