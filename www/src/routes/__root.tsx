import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import { NotFoundPage } from "@/components/not-found-page";
import { SiteHeader } from "@/components/site-header";
import { DeferredChatWidget } from "@/components/chat/deferred-chat-widget";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth/context";
import { DashboardRefreshProvider } from "@/lib/dashboard/refresh-context";
import { defaultSiteHead } from "@/lib/embed-meta";
import { ThemeProvider } from "@/lib/theme/context";
import { themeInitScript } from "@/lib/theme/script";
import appCss from "../styles.css?url";
import geistLatinWoff2 from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => {
    const siteHead = defaultSiteHead();

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...siteHead.meta,
      ],
      links: [
        {
          rel: "icon",
          href: `${import.meta.env.BASE_URL}favicon.svg`,
          type: "image/svg+xml",
        },
        {
          rel: "preload",
          href: geistLatinWoff2,
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous",
        },
        { rel: "stylesheet", href: appCss },
        ...siteHead.links,
      ],
    };
  },
  notFoundComponent: () => <NotFoundPage />,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          defer
          src="https://analytics.fascinated.cc/script.js"
          data-website-id="e25c7904-cda4-409b-8a4f-4baf1d5f5128"
        />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <DashboardRefreshProvider>
                <div className="site-layout">
                  <SiteHeader />
                  {children}
                </div>
              </DashboardRefreshProvider>
              <Toaster richColors closeButton />
              <DeferredChatWidget />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
