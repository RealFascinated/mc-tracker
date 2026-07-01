import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  AddServerLookupDialog,
  type AddServerLookupState,
} from "@/components/admin/add-server-lookup-dialog";
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

export const Route = createFileRoute("/_admin/admin/servers")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminServersQueryOptions()),
  head: () => ({
    meta: [{ title: pageTitle("Admin servers") }],
  }),
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

function AdminServersPage() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminServersQueryOptions());
  const [form, setForm] = useState(emptyForm);
  const [editState, setEditState] = useState<EditServerState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminServer | null>(null);
  const [lookupState, setLookupState] = useState<AddServerLookupState | null>(
    null,
  );
  const [isCheckingServer, setIsCheckingServer] = useState(false);

  const createMutation = useMutation({
    mutationFn: createAdminServer,
    onSuccess: async () => {
      toast.success("Server added");
      setForm(emptyForm);
      setLookupState(null);
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
      setEditState(null);
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
      setDeleteTarget(null);
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
      name: form.name.trim(),
      host: form.host.trim(),
      port: form.port,
      type: form.type,
    };

    setIsCheckingServer(true);
    try {
      const { server, error } = await lookupMcutilsServer(body);
      if (error || !server) {
        setLookupState({
          kind: "error",
          message: error?.message ?? "Server is offline or unreachable.",
        });
        return;
      }
      setLookupState({ kind: "confirm", body, server });
    } catch (err) {
      setLookupState({
        kind: "error",
        message: errorMessage(err),
      });
    } finally {
      setIsCheckingServer(false);
    }
  }

  function handleConfirmCreate() {
    if (lookupState?.kind !== "confirm") {
      return;
    }
    createMutation.mutate(lookupState.body);
  }

  function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editState) {
      return;
    }
    updateMutation.mutate({
      id: editState.target.id,
      body: editState.form,
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
                values={form}
                onChange={setForm}
              />
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  variant="brand"
                  disabled={isCheckingServer || createMutation.isPending}
                >
                  {isCheckingServer
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
                setEditState({ target: server, form: serverToForm(server) })
              }
              onPauseChange={(server, paused) =>
                pauseMutation.mutate({ id: server.id, paused })
              }
              onDelete={setDeleteTarget}
            />
          </div>
        </section>
      </div>

      <AddServerLookupDialog
        state={lookupState}
        isAdding={createMutation.isPending}
        onClose={() => setLookupState(null)}
        onConfirm={handleConfirmCreate}
      />

      <Dialog
        open={editState != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditState(null);
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Edit server</DialogTitle>
            <DialogDescription>
              {editState
                ? `Update connection details for "${editState.target.name}".`
                : null}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleEdit}>
            <AdminServerFormFields
              idPrefix="edit"
              values={editState?.form ?? emptyForm}
              onChange={(nextForm) =>
                setEditState((current) =>
                  current ? { ...current, form: nextForm } : current,
                )
              }
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditState(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="brand"
                disabled={updateMutation.isPending || !editState}
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete server?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This removes "${deleteTarget.name}" permanently. Pause tracking instead to keep the server configured without pings.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending || !deleteTarget}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id);
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
