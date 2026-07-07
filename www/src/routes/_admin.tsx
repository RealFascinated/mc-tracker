import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Server, Settings, Users } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { requireAdminAccess } from "@/lib/auth/require-admin";
import { useAuth } from "@/lib/auth/context";

const adminNav = [
  {
    to: "/admin/settings",
    label: "Settings",
    icon: Settings,
    exact: true,
    adminOnly: true,
  },
  {
    to: "/admin/servers",
    label: "Servers",
    icon: Server,
    exact: true,
    adminOnly: false,
  },
  {
    to: "/admin/users",
    label: "Users",
    icon: Users,
    exact: true,
    adminOnly: true,
  },
] as const;

export const Route = createFileRoute("/_admin")({
  beforeLoad: () => requireAdminAccess(),
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = useAuth();

  const nav = adminNav.filter(
    (item) => user?.role === "admin" || !item.adminOnly,
  );

  return (
    <AppShell section="Administration" nav={[...nav]} fullWidth>
      <Outlet />
    </AppShell>
  );
}
