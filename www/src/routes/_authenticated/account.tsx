import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AccountChatQuotaSection } from "@/components/account/chat-quota-section";
import { AccountPinnedServersSection } from "@/components/account/pinned-servers-section";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
import { errorMessage } from "@/lib/api/error-message";
import { changePassword, deleteAccount, logout, updateProfile } from "@/lib/auth";
import { useAuth } from "@/lib/auth/context";
import { validateProfileUpdate } from "@/lib/auth/validation";
import { pageTitle } from "@/lib/page-title";
import { privatePageHead } from "@/lib/embed-meta";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => privatePageHead(pageTitle("Account")),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setEmail(user?.email ?? "");
    setDisplayName(user?.displayName ?? "");
  }, [user?.displayName, user?.email]);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = validateProfileUpdate(
      { email, displayName },
      { originalEmail: user?.email },
    );
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid profile details");
      return;
    }

    setIsProfileSubmitting(true);
    try {
      const updated = await updateProfile({
        email: parsed.data.email,
        displayName: parsed.data.displayName,
      });
      setUser(updated);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsProfileSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newPassword) {
      toast.error("Enter a new password");
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password updated");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsPasswordSubmitting(false);
    }
  }


  async function handleDeleteAccount() {
    if (!deletePassword) {
      toast.error("Enter your password to confirm deletion");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount({ password: deletePassword });
      await logout();
      setUser(null);
      setDeleteDialogOpen(false);
      setDeletePassword("");
      toast.success("Account deleted");
      await navigate({ to: "/login" });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Account"
        description="Manage your profile, chat assistant, and pinned servers."
      />

      <div className="flex max-w-2xl flex-col gap-6">
        <section className="app-shell-section">
          <div className="app-shell-section-header">
            <h2 className="app-shell-section-title">Account details</h2>
            <p className="app-shell-section-description">
              Your email, display name, and role on this tracker instance.
            </p>
          </div>
          <div className="app-shell-section-body">
            <form className="flex flex-col gap-4" onSubmit={handleProfileSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  autoComplete="nickname"
                  placeholder="Optional"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Role
                </span>
                <span className="text-sm font-medium capitalize">{user?.role}</span>
              </div>
              <div>
                <Button type="submit" disabled={isProfileSubmitting}>
                  {isProfileSubmitting ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <AccountChatQuotaSection />
        <AccountPinnedServersSection />

        <section className="app-shell-section">
          <div className="app-shell-section-header">
            <h2 className="app-shell-section-title">Change password</h2>
            <p className="app-shell-section-description">
              Update your password to keep your account secure.
            </p>
          </div>
          <div className="app-shell-section-body">
            <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div>
                <Button type="submit" disabled={isPasswordSubmitting}>
                  {isPasswordSubmitting ? "Updating…" : "Update password"}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section className="app-shell-section border-destructive/30">
          <div className="app-shell-section-header">
            <h2 className="app-shell-section-title text-destructive">Delete account</h2>
            <p className="app-shell-section-description">
              Permanently remove your account. This cannot be undone.
            </p>
          </div>
          <div className="app-shell-section-body">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete account
            </Button>
          </div>
        </section>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent showCloseButton>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                Enter your password to confirm. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="deletePassword">Password</Label>
              <Input
                id="deletePassword"
                name="deletePassword"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeletePassword("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isDeleting}
                onClick={() => void handleDeleteAccount()}
              >
                {isDeleting ? "Deleting…" : "Delete account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
