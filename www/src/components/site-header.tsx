import { Link, useNavigate, useRouterState } from "@tanstack/react-router";

import { DashboardRangeToggle } from "@/components/dashboard/dashboard-range-toggle";
import { DashboardSearchInput } from "@/components/dashboard/dashboard-search-input";
import { DashboardTimeControls } from "@/components/dashboard/dashboard-time-controls";
import { SiteHeaderActions } from "@/components/site-header-actions";
import { useMetricTimeWindowControls } from "@/hooks/use-metric-time-window-controls";
import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import {
  activeDashboardHeaderRoute,
  DASHBOARD_HEADER_ROUTE_OPTIONS,
  isDashboardHeaderRoute,
  showsSiteHeaderPageNav,
} from "@/lib/dashboard/header-routes";
import type { DashboardHeaderRoute } from "@/lib/dashboard/header-routes";
import { APP_NAME } from "@/lib/page-title";
import { parseMetricTimeWindowSearch } from "@/lib/metrics/time-window";
import { cn } from "cnfast";

const SITE_LOGO = `${import.meta.env.BASE_URL}favicon.svg`;

function showsHeaderSearch(pathname: string): boolean {
  return pathname.startsWith("/servers");
}

function SiteHeaderPageNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const navigate = useNavigate();
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const activeRoute = activeDashboardHeaderRoute(pathname);

  return (
    <DashboardRangeToggle
      value={activeRoute}
      options={DASHBOARD_HEADER_ROUTE_OPTIONS}
      onValueChange={(to) => {
        void navigate({
          to: to as DashboardHeaderRoute,
          search: timeWindowSearch,
        });
      }}
      aria-label="Dashboard pages"
      className="site-header-page-nav shrink-0"
    />
  );
}

type SiteHeaderBarProps = {
  showDashboardControls: boolean;
};

function SiteHeaderBar({ showDashboardControls }: SiteHeaderBarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const metricSearch = useRouterState({
    select: (state) =>
      parseMetricTimeWindowSearch(
        state.location.search as Record<string, unknown>,
      ),
  });
  const navigate = useNavigate();
  const { timeWindow, setPresetTimeRange, setCustomTimeRange } =
    useMetricTimeWindowControls(
      metricSearch,
      (options) => void navigate(options as never),
    );

  return (
    <>
      <div className="site-header-toolbar">
        <div className="dashboard-header-search-slot">
          {showDashboardControls && showsHeaderSearch(pathname) ? (
            <DashboardSearchInput />
          ) : null}
        </div>
      </div>
      <div className="site-header-nav">
        <div className="site-header-controls">
          <SiteHeaderPageNav />
          {showDashboardControls ? (
            <DashboardTimeControls
              window={timeWindow}
              onPresetChange={setPresetTimeRange}
              onCustomChange={setCustomTimeRange}
            />
          ) : null}
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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isDashboardPage = isDashboardHeaderRoute(pathname);
  const hasPageNav = showsSiteHeaderPageNav(pathname);

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
          hasPageNav ? null : "max-w-7xl",
          hasPageNav
            ? "site-header-inner--with-toolbar"
            : "site-header-inner--simple",
        )}
      >
        <Link
          to="/servers"
          className="site-header-brand flex shrink-0 items-center gap-2 text-base font-bold text-foreground hover:text-monitor dark:hover:text-warning"
        >
          <img
            src={SITE_LOGO}
            alt=""
            className="size-6 shrink-0"
            width={24}
            height={24}
          />
          {APP_NAME}
        </Link>

        {hasPageNav ? (
          <SiteHeaderBar showDashboardControls={isDashboardPage} />
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
