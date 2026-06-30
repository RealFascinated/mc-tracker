import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAdminServer,
  deleteAdminServer,
  type AdminServer,
  type CreateServerRequest,
} from "@/lib/api/admin/servers";
import {
  adminServersQueryKey,
  adminServersQueryOptions,
} from "@/lib/api/admin/servers.queries";
import { errorMessage } from "@/lib/api/error-message";
import { pageTitle } from "@/lib/page-title";

export const Route = createFileRoute("/_admin/admin/servers")({
  head: () => ({
    meta: [{ title: pageTitle("Admin servers") }],
  }),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminServersQueryOptions()),
  component: AdminServersPage,
});

const emptyForm: CreateServerRequest = {
  name: "",
  host: "",
  port: null,
  type: "PC",
};

function AdminServersPage() {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(adminServersQueryOptions());
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AdminServer | null>(null);

  const createMutation = useMutation({
    mutationFn: createAdminServer,
    onSuccess: async () => {
      toast.success("Server added");
      setForm(emptyForm);
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

  if (error || !data) {
    return <p className="text-destructive">Failed to load servers.</p>;
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({
      name: form.name.trim(),
      host: form.host.trim(),
      port: form.port,
      type: form.type,
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add server</CardTitle>
          <CardDescription>
            Track a Java (PC) or Bedrock (PE) Minecraft server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
            <div className="grid gap-2">
              <Label htmlFor="server-name">Name</Label>
              <Input
                id="server-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="server-host">Host</Label>
              <Input
                id="server-host"
                value={form.host}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    host: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="server-port">Port</Label>
              <Input
                id="server-port"
                type="number"
                value={form.port ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    port: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
                placeholder="Default"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="server-type">Type</Label>
              <select
                id="server-type"
                className="flex h-8 w-full rounded-snug border border-border bg-card px-2 text-sm"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value,
                  }))
                }
              >
                <option value="PC">Java (PC)</option>
                <option value="PE">Bedrock (PE)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                variant="brand"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Adding…" : "Add server"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracked servers</CardTitle>
          <CardDescription>
            {data.servers.length} server{data.servers.length === 1 ? "" : "s"}{" "}
            in memory and the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.servers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No servers yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.servers.map((server) => (
                <li
                  key={server.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{server.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {server.type} · {server.host}
                      {server.port != null ? `:${server.port}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget(server)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
                ? `This removes "${deleteTarget.name}" from tracking. Player history in VictoriaMetrics is kept.`
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
    </div>
  );
}
