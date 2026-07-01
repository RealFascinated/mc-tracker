import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthPageShell } from "@/components/auth-page-shell";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSignupEnabled } from "@/lib/api/auth-config";
import { errorMessage } from "@/lib/api/error-message";
import { signup } from "@/lib/auth";
import { useAuth } from "@/lib/auth/context";
import { validateCredentials } from "@/lib/auth/validation";
import { pageTitle } from "@/lib/page-title";
import { privatePageHead } from "@/lib/embed-meta";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => privatePageHead(pageTitle("Sign up")),
  component: SignupPage,
});

function SignupPage() {
  const { user, isLoading, setUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: signupConfig, isPending: signupConfigPending } = useQuery({
    queryKey: ["auth", "signup-enabled"],
    queryFn: getSignupEnabled,
  });

  useEffect(() => {
    if (!isLoading && user) {
      void navigate({ to: user.role === "admin" ? "/admin" : "/account" });
    }
  }, [isLoading, user, navigate]);

  if (isLoading || signupConfigPending) {
    return <LoadingState message="Loading…" centered />;
  }

  if (!signupConfig?.signUpEnabled) {
    return (
      <AuthPageShell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign up unavailable</CardTitle>
            <CardDescription>
              New account registration is disabled on this tracker.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthPageShell>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateCredentials({ username, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid credentials");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signup(parsed.data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setUser(result.user);
      toast.success(`Welcome, ${result.user.username}`);
      await navigate({ to: "/account" });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageShell>
      <Card className="motion-auth-card w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Register a user account for this MC Tracker instance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" variant="brand" disabled={isSubmitting}>
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-monitor dark:text-warning">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
