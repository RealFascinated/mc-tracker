const DASHBOARD_HEADER_ROUTES = [
  { to: "/servers", label: "Servers" },
  { to: "/asns", label: "ASNs" },
  { to: "/compare", label: "Compare" },
] as const;

function isDashboardHeaderRoute(pathname: string): boolean {
  return DASHBOARD_HEADER_ROUTES.some((item) => pathname.startsWith(item.to));
}

export { DASHBOARD_HEADER_ROUTES, isDashboardHeaderRoute };
