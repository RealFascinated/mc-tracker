import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { getSignupEnabled } from "@/lib/api/auth-config";
import { useAuth } from "@/lib/auth";
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
  const { data: signupConfig } = useQuery({
    queryKey: ["auth", "signup-enabled"],
    queryFn: getSignupEnabled,
  });

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
          {signupConfig?.signUpEnabled ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              No account yet?{" "}
              <Link to="/signup" className="text-monitor dark:text-warning">
                Sign up
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
