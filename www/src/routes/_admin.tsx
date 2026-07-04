import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Server, Settings, Users } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

const adminNav = [
  {
    to: "/admin/settings",
    label: "Settings",
    icon: Settings,
    exact: true,
  },
  {
    to: "/admin/servers",
    label: "Servers",
    icon: Server,
    exact: true,
  },
  {
    to: "/admin/users",
    label: "Users",
    icon: Users,
    exact: true,
  },
] as const;

export const Route = createFileRoute("/_admin")({
  beforeLoad: () => requireAdmin(),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AppShell
      section="Administration"
      nav={[...adminNav]}
      backLink={{ to: "/servers", label: "Back to dashboard" }}
      fullWidth
    >
      <Outlet />
    </AppShell>
  );
}
