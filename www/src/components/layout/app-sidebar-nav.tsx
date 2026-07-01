import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export type AppSidebarNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type AppSidebarNavProps = {
  section: string;
  items: AppSidebarNavItem[];
  backLink?: {
    to: string;
    label: string;
  };
  footer?: React.ReactNode;
};

function AppSidebarNav({
  section,
  items,
  backLink,
  footer,
}: AppSidebarNavProps) {
  return (
    <aside className="app-shell-sidebar">
      <div className="app-shell-sidebar-inner">
        <div className="app-shell-sidebar-header">
          <p className="app-shell-sidebar-section">{section}</p>
        </div>

        <nav
          className="app-shell-sidebar-nav"
          aria-label={`${section} navigation`}
        >
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="app-shell-sidebar-link"
              activeProps={{ className: "app-shell-sidebar-link--active" }}
              activeOptions={{ exact: item.exact ?? false }}
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {footer ? (
          <div className="app-shell-sidebar-footer">{footer}</div>
        ) : null}

        {backLink ? (
          <div className="app-shell-sidebar-back">
            <Link to={backLink.to} className="app-shell-sidebar-back-link">
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              <span>{backLink.label}</span>
            </Link>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

type AppSidebarMobileNavProps = {
  items: AppSidebarNavItem[];
};

function AppSidebarMobileNav({ items }: AppSidebarMobileNavProps) {
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

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("app-shell-page-header", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="app-shell-page-title">{title}</h1>
        {description ? (
          <p className="app-shell-page-description">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export { AppSidebarMobileNav, AppSidebarNav, PageHeader };
