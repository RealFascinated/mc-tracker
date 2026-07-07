import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SettingsField } from "@/components/admin/settings/fields";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateUserFlags } from "@/lib/api/admin/users";
import type { AdminUser } from "@/lib/api/admin/users";
import {
  adminUsersQueryKey,
  adminUsersQueryOptions,
} from "@/lib/api/admin/users.queries";
import { errorMessage } from "@/lib/api/error-message";
import { formatMediumDateTime } from "@/lib/formatter";
import { pageTitle } from "@/lib/page-title";
import { privatePageHead } from "@/lib/embed-meta";
import { hasFlag, setFlag, USER_FLAGS } from "@/lib/user-flags";
import { requireAdmin } from "@/lib/auth/require-admin";

export const Route = createFileRoute("/_admin/admin/users")({
  beforeLoad: () => requireAdmin(),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminUsersQueryOptions()),
  head: () => privatePageHead(pageTitle("Admin users")),
  component: AdminUsersPage,
});

type EditFlagsState = {
  user: AdminUser;
  flags: number;
};

function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(adminUsersQueryOptions());
  const [editState, setEditState] = useState<EditFlagsState | null>(null);

  const flagsMutation = useMutation({
    mutationFn: ({ id, flags }: { id: string; flags: number }) =>
      updateUserFlags(id, flags),
    onSuccess: async () => {
      toast.success("User flags saved");
      setEditState(null);
      await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isPending) {
    return <LoadingState message="Loading users…" />;
  }

  if (!data) {
    return <p className="text-destructive">Failed to load users.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage user accounts." />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[1%]">Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.username}</TableCell>
              <TableCell className="capitalize">{user.role}</TableCell>
              <TableCell>{formatMediumDateTime(user.createdAt)}</TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditState({ user, flags: user.flags })}
                >
                  Edit flags
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <EditFlagsDialog
        editState={editState}
        saving={flagsMutation.isPending}
        onClose={() => setEditState(null)}
        onFlagsChange={(flags) =>
          setEditState((current) => (current ? { ...current, flags } : current))
        }
        onSave={() => {
          if (!editState) {
            return;
          }
          flagsMutation.mutate({
            id: editState.user.id,
            flags: editState.flags,
          });
        }}
      />
    </div>
  );
}

function EditFlagsDialog({
  editState,
  saving,
  onClose,
  onFlagsChange,
  onSave,
}: {
  editState: EditFlagsState | null;
  saving: boolean;
  onClose: () => void;
  onFlagsChange: (flags: number) => void;
  onSave: () => void;
}) {
  const user = editState?.user ?? null;
  const flags = editState?.flags ?? 0;
  const isDirty = user !== null && flags !== user.flags;

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {user ? `Flags for ${user.username}` : "User flags"}
          </DialogTitle>
          <DialogDescription>
            Toggle flags assigned to this account.
          </DialogDescription>
        </DialogHeader>

        {user ? (
          <div className="settings-fields">
            {user.role === "admin" ? (
              <p className="text-muted-foreground text-sm">
                Admins automatically have all flags.
              </p>
            ) : null}

            {USER_FLAGS.map((entry) => (
              <SettingsField
                key={entry.id}
                label={entry.label}
                htmlFor={`flag-${entry.id}`}
                hint={entry.description}
                switchControl
              >
                <Switch
                  id={`flag-${entry.id}`}
                  checked={hasFlag(flags, entry.flag)}
                  disabled={saving}
                  onCheckedChange={(enabled) =>
                    onFlagsChange(setFlag(flags, entry.flag, enabled))
                  }
                />
              </SettingsField>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!isDirty || saving} onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
