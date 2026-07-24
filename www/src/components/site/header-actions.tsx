import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  LogIn,
  LogOut,
  Shield,
  User,
} from "lucide-react";
import { useState } from "react";

import { ThemeSwitcher } from "@/components/site/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth";
import { useAuth } from "@/lib/auth/context";
import { adminLandingPath } from "@/lib/auth/require-admin";
import { userDisplayName } from "@/lib/auth/user-display";
import { canManageServers } from "@/lib/user-flags";
import { cn } from "cnfast";

type SiteHeaderUserMenuProps = {
  iconOnly?: boolean;
};

function SiteHeaderUserMenu({ iconOnly = false }: SiteHeaderUserMenuProps) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) {
    return null;
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      queryClient.clear();
      setUser(null);
      await navigate({ to: "/login" });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="default"
          className="site-header-nav-button gap-1.5"
          aria-label="Account menu"
        >
          <User className="size-4 shrink-0" aria-hidden />
          <span
            className={cn(
              "max-w-32 truncate",
              iconOnly ? "hidden lg:inline" : "hidden sm:inline",
            )}
          >
            {userDisplayName(user)}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground",
              iconOnly ? "hidden lg:inline" : "hidden sm:inline",
            )}
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="truncate font-medium text-foreground">
              {userDisplayName(user)}
            </span>
            <span className="text-xs capitalize text-muted-foreground">
              {user.role}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">
            <User className="size-4" aria-hidden />
            Account
          </Link>
        </DropdownMenuItem>
        {canManageServers(user.flags) ? (
          <DropdownMenuItem asChild>
            <Link to={adminLandingPath(user)}>
              <Shield className="size-4" aria-hidden />
              {user.role === "admin" ? "Admin" : "Manage servers"}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isLoggingOut}
          onClick={handleLogout}
        >
          <LogOut className="size-4" aria-hidden />
          {isLoggingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SiteHeaderActions({ iconOnly = false }: { iconOnly?: boolean }) {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <ThemeSwitcher />
      {isAuthenticated ? (
        <SiteHeaderUserMenu iconOnly={iconOnly} />
      ) : (
        <Button
          variant="outline"
          size="default"
          asChild
          className="site-header-nav-button"
        >
          <Link to="/login" aria-label="Sign in">
            <LogIn
              className={cn("size-4", iconOnly ? "lg:hidden" : "sm:hidden")}
              aria-hidden
            />
            <span
              className={iconOnly ? "hidden lg:inline" : "hidden sm:inline"}
            >
              Sign in
            </span>
          </Link>
        </Button>
      )}
    </>
  );
}

export { SiteHeaderActions, SiteHeaderUserMenu };
