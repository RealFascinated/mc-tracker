import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Server, Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/auth";

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
      backLink={{ to: "/", label: "Back to dashboard" }}
      fullWidth
    >
      <Outlet />
    </AppShell>
  );
}
