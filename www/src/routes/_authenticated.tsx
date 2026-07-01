import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { LoadingState } from "@/components/loading-state";
import { useAuth } from "@/lib/auth/context";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({ to: "/login" });
    }
  }, [isLoading, user, navigate]);

  if (isLoading || !user) {
    return <LoadingState message="Checking session…" centered />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl">
      <div className="app-shell-content">
        <Outlet />
      </div>
    </main>
  );
}
