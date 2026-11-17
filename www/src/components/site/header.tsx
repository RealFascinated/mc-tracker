import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Columns2, Network, Server } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { lazy, Suspense } from "react";

import { SiteHeaderActions } from "@/components/site/header-actions";
import { useMetricTimeWindowControls } from "@/hooks/metrics/use-metric-time-window-controls";
import { useMetricTimeWindowLinkSearch } from "@/hooks/metrics/use-metric-time-window-link-search";
import {
  activeDashboardHeaderRoute,
  DASHBOARD_HEADER_ROUTES,
  isDashboardHeaderRoute,
  showsHeaderSearch,
} from "@/lib/dashboard/header-routes";
import { APP_NAME } from "@/lib/page-title";
import { parseMetricTimeWindowSearch } from "@/lib/metrics/time-window";
import { cn } from "cnfast";

const SITE_LOGO = `${import.meta.env.BASE_URL}favicon.svg`;

// Only rendered on dashboard routes; keep their deps (servers API, dropdowns)
// out of the root chunk that ships on every page.
const DashboardSearchInput = lazy(() =>
  import("@/components/dashboard/controls/search-input").then((mod) => ({
    default: mod.DashboardSearchInput,
  })),
);

const DashboardTimeControls = lazy(() =>
  import("@/components/dashboard/controls/time-controls").then((mod) => ({
    default: mod.DashboardTimeControls,
  })),
);

const NAV_ICONS: Record<string, LucideIcon> = {
  "/servers": Server,
  "/asns": Network,
  "/compare": Columns2,
};

function Brand({ className }: { className?: string }) {
  return (
    <Link to="/servers" className={cn("rail-brand", className)}>
      <img
        src={SITE_LOGO}
        alt=""
        width={22}
        height={22}
        className="size-[22px]"
      />
      <span>{APP_NAME}</span>
    </Link>
  );
}

function RailNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const active = activeDashboardHeaderRoute(pathname);

  return (
    <nav
      aria-label="Primary"
      className={orientation === "vertical" ? "rail-nav" : "rail-nav-inline"}
    >
      {DASHBOARD_HEADER_ROUTES.map((route) => {
        const Icon = NAV_ICONS[route.to];
        const isActive = active === route.to;

        return (
          <Link
            key={route.to}
            to={route.to}
            search={timeWindowSearch}
            aria-current={isActive ? "page" : undefined}
            className={cn("rail-link", isActive && "rail-link--active")}
          >
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
            <span>{route.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Topbar() {
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

  if (!isDashboardHeaderRoute(pathname)) {
    return null;
  }

  return (
    <div className="topbar">
      <div className="topbar-search">
        {showsHeaderSearch(pathname) ? (
          <Suspense fallback={null}>
            <DashboardSearchInput />
          </Suspense>
        ) : null}
      </div>
      <Suspense fallback={null}>
        <DashboardTimeControls
          window={timeWindow}
          onPresetChange={setPresetTimeRange}
          onCustomChange={setCustomTimeRange}
        />
      </Suspense>
    </div>
  );
}

function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-layout">
      <aside className="rail">
        <Brand />
        <RailNav orientation="vertical" />
        <div className="rail-footer">
          <SiteHeaderActions variant="rail" />
        </div>
      </aside>

      <header className="mobile-bar">
        <Brand />
        <RailNav orientation="horizontal" />
        <div className="mobile-bar-actions">
          <SiteHeaderActions iconOnly />
        </div>
      </header>

      <div className="site-main">
        <Topbar />
        {children}
      </div>
    </div>
  );
}

export { SiteFrame };
