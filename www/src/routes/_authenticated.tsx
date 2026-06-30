import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { LoadingState } from "@/components/loading-state"
import { Button } from "@/components/ui/button"
import { logout, useAuth } from "@/lib/auth"

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user, isLoading, setUser } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({ to: "/login" })
    }
  }, [isLoading, user, navigate])

  if (isLoading || !user) {
    return <LoadingState message="Checking session…" centered />
  }

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logout()
      queryClient.clear()
      setUser(null)
      await navigate({ to: "/login" })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Account</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.username} ({user.role})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Dashboard</Link>
          </Button>
          {user.role === "admin" ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin">Admin</Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
      <Outlet />
    </main>
  )
}
