import { Link, Outlet, createFileRoute } from "@tanstack/react-router"

import { requireAdmin } from "@/lib/auth"

export const Route = createFileRoute("/_admin")({
  beforeLoad: () => requireAdmin(),
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage servers and application settings.
          </p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            to="/admin/settings"
            className="text-muted-foreground hover:text-foreground"
            activeProps={{ className: "font-medium text-foreground" }}
          >
            Settings
          </Link>
          <Link
            to="/admin/servers"
            className="text-muted-foreground hover:text-foreground"
            activeProps={{ className: "font-medium text-foreground" }}
          >
            Servers
          </Link>
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground"
          >
            Dashboard
          </Link>
        </nav>
      </div>
      <Outlet />
    </main>
  )
}
