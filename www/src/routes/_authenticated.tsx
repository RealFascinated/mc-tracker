import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { logout, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, isLoading, setUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({ to: "/login" });
    }
  }, [isLoading, user, navigate]);

  if (isLoading || !user) {
    return <LoadingState message="Checking session…" centered />;
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      queryClient.clear();
      setUser(null);
      await navigate({ to: "/login" });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <AppShell
      section="Account"
      nav={[{ to: "/account", label: "Profile", icon: User, exact: true }]}
      backLink={{ to: "/", label: "Back to dashboard" }}
      sidebarFooter={
        <div className="flex flex-col gap-1">
          <p className="px-3 py-1 text-xs text-sidebar-foreground/60">
            Signed in as{" "}
            <span className="font-medium text-sidebar-foreground">
              {user.username}
            </span>
          </p>
          {user.role === "admin" ? (
            <Link
              to="/admin"
              className="app-shell-sidebar-link text-sidebar-foreground/80"
            >
              Administration
            </Link>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 px-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  );
}
