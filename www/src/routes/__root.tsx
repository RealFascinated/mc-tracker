import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import { SiteHeader } from "@/components/site-header";
import { SiteHeaderToolbarProvider } from "@/components/site-header-toolbar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { DashboardRefreshProvider } from "@/lib/dashboard/refresh-context";
import { APP_NAME } from "@/lib/page-title";
import { ThemeProvider } from "@/lib/theme";
import { themeInitScript } from "@/lib/theme/script";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
    ],
    links: [
      {
        rel: "icon",
        href: `${import.meta.env.BASE_URL}favicon.svg`,
        type: "image/svg+xml",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <SiteHeaderToolbarProvider>
                <DashboardRefreshProvider>
                  <div className="site-layout">
                    <SiteHeader />
                    {children}
                  </div>
                </DashboardRefreshProvider>
              </SiteHeaderToolbarProvider>
              <Toaster richColors closeButton />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
