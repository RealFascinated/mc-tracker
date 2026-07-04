import { Link, useNavigate, useRouterState } from "@tanstack/react-router";

import { DashboardSearchInput } from "@/components/dashboard/dashboard-search-input";
import { DashboardTimeControls } from "@/components/dashboard/dashboard-time-controls";
import { SiteHeaderActions } from "@/components/site-header-actions";
import { useMetricTimeWindowControls } from "@/hooks/use-metric-time-window-controls";
import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import {
  DASHBOARD_HEADER_ROUTES,
  isDashboardHeaderRoute,
} from "@/lib/dashboard/header-routes";
import { APP_NAME } from "@/lib/page-title";
import { parseMetricTimeWindowSearch } from "@/lib/metrics/time-window";
import { cn } from "cnfast";

function showsHeaderSearch(pathname: string): boolean {
  return pathname.startsWith("/servers");
}

function SiteHeaderDashboardBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const metricSearch = useRouterState({
    select: (state) =>
      parseMetricTimeWindowSearch(
        state.location.search as Record<string, unknown>,
      ),
  });
  const navigate = useNavigate();
  const { timeWindow, setPresetTimeRange, setCustomTimeRange } =
    useMetricTimeWindowControls(metricSearch, (options) =>
      void navigate(options as never),
    );

  return (
    <>
      <div className="site-header-toolbar">
        <div className="dashboard-header-search-slot">
          {showsHeaderSearch(pathname) ? <DashboardSearchInput /> : null}
        </div>
      </div>
      <div className="site-header-nav">
        <div className="site-header-controls">
          <nav className="site-header-page-nav" aria-label="Dashboard pages">
            {DASHBOARD_HEADER_ROUTES.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  search={timeWindowSearch}
                  className={cn(
                    "site-header-page-nav-link",
                    active && "site-header-page-nav-link--active",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <DashboardTimeControls
            window={timeWindow}
            onPresetChange={setPresetTimeRange}
            onCustomChange={setCustomTimeRange}
          />
        </div>
      </div>
      <div className="site-header-actions">
        <SiteHeaderActions iconOnly />
      </div>
    </>
  );
}

type SiteHeaderProps = {
  className?: string;
};

function SiteHeader({ className }: SiteHeaderProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isDashboardPage = isDashboardHeaderRoute(pathname);

  return (
    <header
      className={cn(
        "site-header sticky top-0 z-40 shrink-0 border-b border-border bg-background/95 backdrop-blur-sm",
        className,
      )}
    >
      <div
        className={cn(
          "site-header-inner mx-auto px-3 sm:px-5",
          isDashboardPage
            ? "site-header-inner--with-toolbar"
            : "site-header-inner--simple max-w-7xl",
        )}
      >
        <Link
          to="/servers"
          className="site-header-brand shrink-0 text-base font-bold text-foreground hover:text-monitor dark:hover:text-warning"
        >
          {APP_NAME}
        </Link>

        {isDashboardPage ? (
          <SiteHeaderDashboardBar />
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
