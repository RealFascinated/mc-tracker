import { cn } from "cnfast";

import { AppSidebarMobileNav } from "./app-sidebar-mobile-nav";
import { AppSidebarNav } from "./app-sidebar-nav";
import type {AppSidebarNavItem} from "./app-sidebar-nav";

type AppShellProps = {
  section: string;
  nav: AppSidebarNavItem[];
  backLink?: {
    to: string;
    label: string;
  };
  sidebarFooter?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

function AppShell({
  section,
  nav,
  backLink,
  sidebarFooter,
  fullWidth = false,
  className,
  children,
}: AppShellProps) {
  return (
    <div className={cn("app-shell", fullWidth && "app-shell--full-width", className)}>
      <AppSidebarNav
        section={section}
        items={nav}
        backLink={backLink}
        footer={sidebarFooter}
      />
      <div className="app-shell-main">
        <AppSidebarMobileNav items={nav} />
        <div className="app-shell-content">{children}</div>
      </div>
    </div>
  );
}

export { AppShell };
