import { Link, useRouterState } from "@tanstack/react-router";

import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import { cn } from "cnfast";

const SITE_HEADER_PAGES = [
  { to: "/servers", label: "Servers" },
  { to: "/asns", label: "ASNs" },
  { to: "/compare", label: "Compare" },
] as const;

function SiteHeaderPageNav() {
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const onDashboardPage = SITE_HEADER_PAGES.some((item) =>
    pathname.startsWith(item.to),
  );
  if (!onDashboardPage) {
    return null;
  }

  return (
    <nav className="site-header-page-nav" aria-label="Dashboard pages">
      {SITE_HEADER_PAGES.map((item) => {
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
  );
}

export { SiteHeaderPageNav };
