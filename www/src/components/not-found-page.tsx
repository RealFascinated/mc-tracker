import { Link, useRouterState } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { useEffect } from "react";

import { FadeInAnimation } from "@/components/motion/fade-in-animation";
import { Button } from "@/components/ui/button";
import { pageTitle } from "@/lib/page-title";

type NotFoundPageProps = {
  title?: string;
  description?: string;
};

function NotFoundPage({
  title = "Page not found",
  description = "This page doesn't exist or may have been moved.",
}: NotFoundPageProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-16 sm:py-24">
      <FadeInAnimation className="flex max-w-md flex-col items-center text-center">
        <p
          className="text-6xl font-bold tracking-tighter text-monitor/30 dark:text-warning/30"
          aria-hidden
        >
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground/80">
          {pathname}
        </p>
        <Button asChild variant="highlighted" className="mt-6">
          <Link to="/servers">
            <Home />
            Back to dashboard
          </Link>
        </Button>
      </FadeInAnimation>
    </main>
  );
}

export { NotFoundPage };
