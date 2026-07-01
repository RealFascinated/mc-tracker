import type { MetaDescriptor } from "@tanstack/router-core";
import { env } from "@/env";
import { APP_NAME } from "@/lib/page-title";

const DEFAULT_SITE_DESCRIPTION =
  "Track Minecraft server player counts and view historical charts.";

type EmbedLink = {
  rel: string;
  href: string;
};

type RouteHead = {
  meta: MetaDescriptor[];
  links?: EmbedLink[];
};

// TanStack accepts MetaDescriptor at runtime; generated route head types are narrower.
function asRouteHead(head: RouteHead): any {
  return head;
}

function uiBasepath() {
  const base = env.VITE_MC_TRACKER_UI_BASEPATH;
  if (!base) {
    return "";
  }
  return base.startsWith("/") ? base : `/${base}`;
}

function pageUrl(pathname: string): string | undefined {
  const origin = env.VITE_MC_TRACKER_SITE_URL;
  if (!origin) {
    return undefined;
  }

  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${uiBasepath()}${path}`;
}

function siteMeta(): MetaDescriptor[] {
  const url = pageUrl("/");
  const cardType = "summary";

  const meta: MetaDescriptor[] = [
    { title: APP_NAME },
    { name: "description", content: DEFAULT_SITE_DESCRIPTION },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: APP_NAME },
    { property: "og:title", content: APP_NAME },
    { property: "og:description", content: DEFAULT_SITE_DESCRIPTION },
    { name: "twitter:card", content: cardType },
    { name: "twitter:title", content: APP_NAME },
    { name: "twitter:description", content: DEFAULT_SITE_DESCRIPTION },
  ];

  if (url) {
    meta.push({ property: "og:url", content: url });
  }

  meta.push({
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: APP_NAME,
      description: DEFAULT_SITE_DESCRIPTION,
      ...(url ? { url } : {}),
    },
  });

  return meta;
}

export function defaultSiteHead() {
  const url = pageUrl("/");

  return asRouteHead({
    meta: siteMeta(),
    links: url ? [{ rel: "canonical", href: url }] : [],
  });
}

export function privatePageHead(title: string) {
  return asRouteHead({
    meta: [
      { title },
      { name: "robots", content: "noindex, nofollow" },
    ],
  });
}
