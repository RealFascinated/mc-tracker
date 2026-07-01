import { Link } from "@tanstack/react-router";

import { SiteHeaderActions } from "@/components/site-header-actions";
import { useSiteHeaderToolbar } from "@/components/site-header-toolbar";
import { APP_NAME } from "@/lib/page-title";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  className?: string;
};

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
          toolbar
            ? "site-header-inner--with-toolbar"
            : nav
              ? "site-header-inner--with-nav"
              : "site-header-inner--simple",
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
        ) : nav ? (
          <>
            <div className="site-header-nav">{nav}</div>
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
