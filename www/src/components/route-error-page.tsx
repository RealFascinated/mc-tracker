import { Link, isNotFound, useRouter } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { useEffect, useState } from "react";

import { NotFoundPage } from "@/components/not-found-page";
import { QueryErrorState } from "@/components/query-error-state";
import { Button } from "@/components/ui/button";
import { pageTitle } from "@/lib/page-title";

type RouteErrorPageProps = {
  error: Error;
  reset?: () => void;
};

function RouteErrorPage({ error, reset }: RouteErrorPageProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    document.title = pageTitle("Something went wrong");
  }, []);

  if (isNotFound(error)) {
    return <NotFoundPage />;
  }

  async function handleRetry() {
    setIsRetrying(true);
    try {
      await router.invalidate();
    } finally {
      setIsRetrying(false);
      reset?.();
    }
  }

  return (
    <main className="dashboard-shell items-center pt-10 sm:pt-16">
      <div className="flex w-full max-w-lg flex-col items-center gap-4">
        <QueryErrorState
          title="Couldn't load this page"
          error={error}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
        <Button asChild variant="ghost" size="lg">
          <Link to="/servers">
            <Home />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </main>
  );
}

export { RouteErrorPage };
