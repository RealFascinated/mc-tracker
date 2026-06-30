import { createFileRoute } from "@tanstack/react-router"

import { SettingsPreferenceGroup } from "@/components/settings/settings-preference-group"
import { SettingsPreferenceRow } from "@/components/settings/settings-preference-row"
import { SettingsSectionHeader } from "@/components/settings/settings-section-header"
import { ThemeSwitcher } from "@/components/theme-switcher"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import { pageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [{ title: pageTitle("Account") }],
  }),
  component: AccountPage,
})

function AccountPage() {
  const { user } = useAuth()

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
          <p className="text-sm text-muted-foreground">
            Password change will be wired here via{" "}
            <code className="rounded bg-muted px-1">PATCH /auth/password</code>.
          </p>
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
  )
}
