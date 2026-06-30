import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SettingsPreferenceGroup } from "@/components/settings/settings-preference-group";
import { SettingsPreferenceRow } from "@/components/settings/settings-preference-row";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api/error-message";
import { changePassword, useAuth } from "@/lib/auth";
import { pageTitle } from "@/lib/page-title";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [{ title: pageTitle("Account") }],
  }),
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
    <div className="flex flex-col gap-8">
      <Card className="max-w-xl gap-0 py-0 shadow-none">
        <CardHeader className="border-b border-border py-4">
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Signed in as {user?.username} ({user?.role})
          </CardDescription>
        </CardHeader>
        <CardContent className="py-4">
          <form className="grid gap-4" onSubmit={handlePasswordSubmit}>
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
            <Button type="submit" variant="brand" disabled={isSubmitting}>
              {isSubmitting ? "Updating…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <SettingsSectionHeader
          title="Appearance"
          description="How MC Tracker looks on this device."
        />
        <SettingsPreferenceGroup>
          <SettingsPreferenceRow
            label="Theme"
            description="Light, dark, or match your system setting."
            control={<ThemeSwitcher />}
          />
        </SettingsPreferenceGroup>
      </section>
    </div>
  );
}
