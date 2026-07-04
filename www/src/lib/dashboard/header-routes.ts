const DASHBOARD_HEADER_ROUTES = [
  { to: "/servers", label: "Servers" },
  { to: "/asns", label: "ASNs" },
  { to: "/compare", label: "Compare" },
] as const;

type DashboardHeaderRoute = (typeof DASHBOARD_HEADER_ROUTES)[number]["to"];

const DASHBOARD_HEADER_ROUTE_OPTIONS = DASHBOARD_HEADER_ROUTES.map((item) => ({
  value: item.to,
  shortLabel: item.label,
}));

function isDashboardHeaderRoute(pathname: string): boolean {
  return DASHBOARD_HEADER_ROUTES.some((item) => pathname.startsWith(item.to));
}

function activeDashboardHeaderRoute(pathname: string): DashboardHeaderRoute | "" {
  const match = DASHBOARD_HEADER_ROUTES.find((item) =>
    pathname.startsWith(item.to),
  );
  return match?.to ?? "";
}

function showsSiteHeaderPageNav(pathname: string): boolean {
  return isDashboardHeaderRoute(pathname) || pathname.startsWith("/admin");
}

export {
  activeDashboardHeaderRoute,
  DASHBOARD_HEADER_ROUTE_OPTIONS,
  DASHBOARD_HEADER_ROUTES,
  isDashboardHeaderRoute,
  showsSiteHeaderPageNav,
};
export type { DashboardHeaderRoute };
