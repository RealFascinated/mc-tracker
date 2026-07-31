import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminServerFormFields } from "@/components/admin/servers/form-fields";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CreateServerRequest } from "@/lib/api/admin/servers";
import { errorMessage } from "@/lib/api/error-message";
import { privatePageHead } from "@/lib/embed-meta";
import { formatMediumDateTime } from "@/lib/formatter";
import { pageTitle } from "@/lib/page-title";
import {
  adminServerSuggestionsQueryKey,
  adminServerSuggestionsQueryOptions,
} from "@/lib/api/server-suggestions.queries";
import {
  approveServerSuggestion,
  deleteServerSuggestion,
  denyServerSuggestion,
} from "@/lib/api/server-suggestions";
import type { ServerSuggestion } from "@/lib/api/server-suggestions";

export const Route = createFileRoute("/_admin/admin/suggestions")({
  loader: ({ context: { queryClient } }) => {
    queryClient.ensureQueryData(adminServerSuggestionsQueryOptions("pending"));
    queryClient.ensureQueryData(adminServerSuggestionsQueryOptions("denied"));
  },
  head: () => privatePageHead(pageTitle("Admin suggestions")),
  component: AdminSuggestionsPage,
});

function suggestionToForm(suggestion: ServerSuggestion): CreateServerRequest {
  return {
    name: suggestion.name,
    host: suggestion.host,
    port: suggestion.port,
    type: suggestion.type,
  };
}

function SuggestionTable({
  suggestions,
  renderActions,
}: {
  suggestions: ServerSuggestion[];
  renderActions: (suggestion: ServerSuggestion) => React.ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Platform</TableHead>
          <TableHead>Suggested by</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead className="w-[1%]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {suggestions.map((suggestion) => (
          <TableRow key={suggestion.id}>
            <TableCell className="font-medium">{suggestion.name}</TableCell>
            <TableCell className="font-mono text-xs">
              {suggestion.host}
              {suggestion.port != null ? `:${suggestion.port}` : ""}
            </TableCell>
            <TableCell className="uppercase">{suggestion.type}</TableCell>
            <TableCell>{suggestion.suggestedBy?.name ?? "—"}</TableCell>
            <TableCell>{formatMediumDateTime(suggestion.createdAt)}</TableCell>
            <TableCell>{renderActions(suggestion)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AdminSuggestionsPage() {
  const queryClient = useQueryClient();
  const pendingQuery = useQuery(adminServerSuggestionsQueryOptions("pending"));
  const deniedQuery = useQuery(adminServerSuggestionsQueryOptions("denied"));
  const [approveTarget, setApproveTarget] = useState<ServerSuggestion | null>(
    null,
  );
  const [approveForm, setApproveForm] = useState<CreateServerRequest | null>(
    null,
  );
  const [denyTarget, setDenyTarget] = useState<ServerSuggestion | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ServerSuggestion | null>(
    null,
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminServerSuggestionsQueryKey("pending"),
    });
    await queryClient.invalidateQueries({
      queryKey: adminServerSuggestionsQueryKey("denied"),
    });
  };

  const approveMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CreateServerRequest }) =>
      approveServerSuggestion(id, {
        name: body.name.trim(),
        host: body.host.trim(),
        port: body.port,
        type: body.type,
      }),
    onSuccess: async () => {
      toast.success("Suggestion approved and server added");
      setApproveTarget(null);
      setApproveForm(null);
      await invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const denyMutation = useMutation({
    mutationFn: denyServerSuggestion,
    onSuccess: async () => {
      toast.success("Suggestion denied");
      setDenyTarget(null);
      await invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: deleteServerSuggestion,
    onSuccess: async () => {
      toast.success("Suggestion removed from denied list");
      setRemoveTarget(null);
      await invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (pendingQuery.isPending || deniedQuery.isPending) {
    return <LoadingState message="Loading suggestions…" />;
  }

  const pending = pendingQuery.data?.suggestions ?? [];
  const denied = deniedQuery.data?.suggestions ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suggestions"
        description="Review server suggestions submitted by users."
      />

      <section className="app-shell-section">
        <div className="app-shell-section-header">
          <h2 className="app-shell-section-title">Pending suggestions</h2>
          <p className="app-shell-section-description">
            {pending.length === 0
              ? "No suggestions awaiting review."
              : `${pending.length} suggestion${pending.length === 1 ? "" : "s"} awaiting review.`}
          </p>
        </div>
        <div className="app-shell-section-body">
          {pending.length > 0 ? (
            <SuggestionTable
              suggestions={pending}
              renderActions={(suggestion) => (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    onClick={() => {
                      setApproveTarget(suggestion);
                      setApproveForm(suggestionToForm(suggestion));
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDenyTarget(suggestion)}
                  >
                    Deny
                  </Button>
                </div>
              )}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              No pending suggestions right now.
            </p>
          )}
        </div>
      </section>

      <section className="app-shell-section">
        <div className="app-shell-section-header">
          <h2 className="app-shell-section-title">Denied suggestions</h2>
          <p className="app-shell-section-description">
            Denied servers cannot be suggested again until removed from this
            list.
          </p>
        </div>
        <div className="app-shell-section-body">
          {denied.length > 0 ? (
            <SuggestionTable
              suggestions={denied}
              renderActions={(suggestion) => (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setRemoveTarget(suggestion)}
                >
                  Remove
                </Button>
              )}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              No denied suggestions.
            </p>
          )}
        </div>
      </section>

      <Dialog
        open={approveTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setApproveTarget(null);
            setApproveForm(null);
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Approve suggestion</DialogTitle>
            <DialogDescription>
              Edit the connection details before adding this server to tracking.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!approveTarget || !approveForm) {
                return;
              }
              approveMutation.mutate({
                id: approveTarget.id,
                body: approveForm,
              });
            }}
          >
            {approveForm ? (
              <div className="app-shell-form-grid">
                <AdminServerFormFields
                  idPrefix="approve"
                  values={approveForm}
                  onChange={setApproveForm}
                />
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setApproveTarget(null);
                  setApproveForm(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="brand"
                disabled={approveMutation.isPending || !approveForm}
              >
                {approveMutation.isPending ? "Approving…" : "Approve and add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={denyTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDenyTarget(null);
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Deny suggestion?</DialogTitle>
            <DialogDescription>
              {denyTarget
                ? `This denies "${denyTarget.name}" and adds it to the denied list. It cannot be suggested again until removed.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDenyTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={denyMutation.isPending || !denyTarget}
              onClick={() => {
                if (denyTarget) {
                  denyMutation.mutate(denyTarget.id);
                }
              }}
            >
              {denyMutation.isPending ? "Denying…" : "Deny"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Remove from denied list?</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `This removes "${removeTarget.name}" from the denied list so it can be suggested again.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removeMutation.isPending || !removeTarget}
              onClick={() => {
                if (removeTarget) {
                  removeMutation.mutate(removeTarget.id);
                }
              }}
            >
              {removeMutation.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
