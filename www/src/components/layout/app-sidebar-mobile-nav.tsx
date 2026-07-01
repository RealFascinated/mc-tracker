import { Link } from "@tanstack/react-router";

import type { AppSidebarNavItem } from "@/components/layout/app-sidebar-nav";

type AppSidebarMobileNavProps = {
  items: AppSidebarNavItem[];
};

export function AppSidebarMobileNav({ items }: AppSidebarMobileNavProps) {
  return (
    <nav
      className="app-shell-mobile-nav lg:hidden"
      aria-label="Section navigation"
    >
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="app-shell-mobile-nav-link"
          activeProps={{ className: "app-shell-mobile-nav-link--active" }}
          activeOptions={{ exact: item.exact ?? false }}
        >
          <item.icon className="size-4 shrink-0" aria-hidden />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
