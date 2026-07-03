import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthForm } from "@/components/auth-form";
import { AuthPageShell } from "@/components/auth-page-shell";
import { LoadingState } from "@/components/loading-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth/context";
import { pageTitle } from "@/lib/page-title";
import { privatePageHead } from "@/lib/embed-meta";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => privatePageHead(pageTitle("Sign in")),
  component: LoginPage,
});

function LoginPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      void navigate({ to: user.role === "admin" ? "/admin" : "/account" });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return <LoadingState message="Checking session…" centered />;
  }

  return (
    <AuthPageShell>
      <Card className="motion-auth-card w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Sign in to manage your MC Tracker account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <Link to="/signup" className="text-monitor dark:text-warning">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
