import { Link } from "@tanstack/react-router";
import { LogIn, Shield, User } from "lucide-react";

import { useSiteHeaderToolbar } from "@/components/site-header-toolbar";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { APP_NAME } from "@/lib/page-title";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  className?: string;
};

function SiteHeaderActions({
  iconOnly = false,
}: {
  iconOnly?: boolean;
}) {
  const { user, isAuthenticated } = useAuth();

  return (
    <>
      <ThemeSwitcher />
      {isAuthenticated ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="site-header-nav-button"
          >
            <Link to="/account" aria-label="Account">
              <User
                className={cn("size-4", iconOnly ? "lg:hidden" : "sm:hidden")}
                aria-hidden
              />
              <span className={iconOnly ? "hidden lg:inline" : "hidden sm:inline"}>
                Account
              </span>
            </Link>
          </Button>
          {user?.role === "admin" ? (
            <Button
              variant="highlighted"
              size="sm"
              asChild
              className="site-header-nav-button"
            >
              <Link to="/admin" aria-label="Admin">
                <Shield
                  className={cn("size-4", iconOnly ? "lg:hidden" : "sm:hidden")}
                  aria-hidden
                />
                <span className={iconOnly ? "hidden lg:inline" : "hidden sm:inline"}>
                  Admin
                </span>
              </Link>
            </Button>
          ) : null}
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="site-header-nav-button"
        >
          <Link to="/login" aria-label="Sign in">
            <LogIn
              className={cn("size-4", iconOnly ? "lg:hidden" : "sm:hidden")}
              aria-hidden
            />
            <span className={iconOnly ? "hidden lg:inline" : "hidden sm:inline"}>
              Sign in
            </span>
          </Link>
        </Button>
      )}
    </>
  );
}

function SiteHeader({ className }: SiteHeaderProps) {
  const { toolbar, nav } = useSiteHeaderToolbar();

  return (
    <header
      className={cn(
        "site-header sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm",
        className,
      )}
    >
      <div
        className={cn(
          "site-header-inner mx-auto max-w-7xl px-3 sm:px-5",
          toolbar ? "site-header-inner--with-toolbar" : "site-header-inner--simple",
        )}
      >
        <Link
          to="/"
          className="site-header-brand shrink-0 text-base font-bold text-foreground hover:text-monitor dark:hover:text-warning"
        >
          {APP_NAME}
        </Link>

        {toolbar ? (
          <>
            <div className="site-header-toolbar">{toolbar}</div>
            {nav ? <div className="site-header-nav">{nav}</div> : null}
            <div className="site-header-actions">
              <SiteHeaderActions iconOnly />
            </div>
          </>
        ) : (
          <nav className="site-header-nav site-header-nav--simple">
            <SiteHeaderActions />
          </nav>
        )}
      </div>
    </header>
  );
}

export { SiteHeader };
