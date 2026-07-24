import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AccountChatQuotaSection } from "@/components/account/chat-quota-section";
import { AccountPinnedServersSection } from "@/components/account/pinned-servers-section";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api/error-message";
import { changePassword } from "@/lib/auth";
import { useAuth } from "@/lib/auth/context";
import { pageTitle } from "@/lib/page-title";
import { privatePageHead } from "@/lib/embed-meta";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => privatePageHead(pageTitle("Account")),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newPassword) {
      toast.error("New password is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your account details and security settings."
      />

      <div className="flex max-w-2xl flex-col gap-6">
        <section className="app-shell-section">
          <div className="app-shell-section-header">
            <h2 className="app-shell-section-title">Account details</h2>
            <p className="app-shell-section-description">
              Your username and role on this tracker instance.
            </p>
          </div>
          <div className="app-shell-section-body">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Username
                </dt>
                <dd className="text-sm font-medium">{user?.username}</dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Role
                </dt>
                <dd className="text-sm font-medium capitalize">{user?.role}</dd>
              </div>
            </dl>
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
            <form
              className="grid max-w-md gap-4"
              onSubmit={handlePasswordSubmit}
            >
              <div className="grid gap-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              <div>
                <Button type="submit" variant="brand" disabled={isSubmitting}>
                  {isSubmitting ? "Updating…" : "Update password"}
                </Button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
