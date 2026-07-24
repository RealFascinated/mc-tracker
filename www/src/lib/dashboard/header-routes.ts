const DASHBOARD_HEADER_ROUTES = [
  { to: "/servers", label: "Servers", showsSearch: true },
  { to: "/asns", label: "ASNs", showsSearch: false },
  { to: "/compare", label: "Compare", showsSearch: false },
] as const;

type DashboardHeaderRoute = (typeof DASHBOARD_HEADER_ROUTES)[number]["to"];

const DASHBOARD_HEADER_ROUTE_OPTIONS = DASHBOARD_HEADER_ROUTES.map((item) => ({
  value: item.to,
  shortLabel: item.label,
}));

function isDashboardHeaderRoute(pathname: string): boolean {
  return DASHBOARD_HEADER_ROUTES.some((item) => pathname.startsWith(item.to));
}

function activeDashboardHeaderRoute(
  pathname: string,
): DashboardHeaderRoute | "" {
  const match = DASHBOARD_HEADER_ROUTES.find((item) =>
    pathname.startsWith(item.to),
  );
  return match?.to ?? "";
}

function showsSiteHeaderPageNav(_pathname: string): boolean {
  return true;
}

function showsHeaderSearch(pathname: string): boolean {
  return DASHBOARD_HEADER_ROUTES.some(
    (route) => route.showsSearch && pathname.startsWith(route.to),
  );
}

export {
  activeDashboardHeaderRoute,
  DASHBOARD_HEADER_ROUTE_OPTIONS,
  DASHBOARD_HEADER_ROUTES,
  isDashboardHeaderRoute,
  showsHeaderSearch,
  showsSiteHeaderPageNav,
};
export type { DashboardHeaderRoute };
