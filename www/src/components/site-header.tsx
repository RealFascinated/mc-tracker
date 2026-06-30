import { Link } from "@tanstack/react-router"

import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { APP_NAME } from "@/lib/page-title"
import { cn } from "@/lib/utils"

type SiteHeaderProps = {
  className?: string
}

function SiteHeader({ className }: SiteHeaderProps) {
  const { user, isAuthenticated } = useAuth()

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm",
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="text-base font-bold text-foreground hover:text-monitor dark:hover:text-warning"
        >
          {APP_NAME}
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeSwitcher />
          {isAuthenticated ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/account">Account</Link>
              </Button>
              {user?.role === "admin" ? (
                <Button variant="highlighted" size="sm" asChild>
                  <Link to="/admin">Admin</Link>
                </Button>
              ) : null}
            </>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}

export { SiteHeader }
