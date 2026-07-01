import type { MetaDescriptor } from "@tanstack/router-core";
import { asnDisplayName } from "@/lib/api/asns";
import type { AsnDetailResponse } from "@/lib/api/asns";
import type { ServerListItem } from "@/lib/api/servers";
import { env } from "@/env";
import { APP_NAME } from "@/lib/page-title";

const DEFAULT_SITE_DESCRIPTION =
  "Track Minecraft server player counts and view historical charts.";

export const DASHBOARD_DESCRIPTION =
  "Live player counts and history for tracked Minecraft servers and networks.";

const DEFAULT_OG_IMAGE = "minecraft-unknown-server.png";

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

function publicAssetUrl(filename: string): string | undefined {
  const origin = env.VITE_MC_TRACKER_SITE_URL;
  if (!origin) {
    return undefined;
  }

  const href = `${import.meta.env.BASE_URL}${filename}`.replace(
    /([^:]\/)\/+/g,
    "$1",
  );
  return `${origin}${href.startsWith("/") ? href : `/${href}`}`;
}

function resolveOgImage(image?: string | null): string | undefined {
  if (image && /^https?:\/\//i.test(image)) {
    return image;
  }
  return publicAssetUrl(DEFAULT_OG_IMAGE);
}

export function serverPageDescription(server: ServerListItem): string {
  const players =
    server.playersOnline != null
      ? `${server.playersOnline} players online`
      : "Player count tracking";
  const platform = server.type === "PE" ? "Bedrock" : "Java";
  return `${server.name} — ${players}. ${platform} server on ${APP_NAME}.`;
}

export function asnPageDescription(
  asn: Pick<AsnDetailResponse, "asn" | "asnOrg" | "playersOnline" | "serverCount">,
): string {
  const name = asnDisplayName(asn);
  return `${name} — ${asn.playersOnline} players across ${asn.serverCount} tracked servers on ${APP_NAME}.`;
}

type EmbedMetaOptions = {
  title: string;
  description?: string;
  image?: string | null;
  pathname?: string;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
};

export function embedMeta({
  title,
  description = DEFAULT_SITE_DESCRIPTION,
  image,
  pathname,
  type = "website",
  noindex = false,
  jsonLd,
}: EmbedMetaOptions): MetaDescriptor[] {
  const resolvedImage = resolveOgImage(image);
  const url = pathname ? pageUrl(pathname) : undefined;
  const cardType = resolvedImage ? "summary_large_image" : "summary";

  const meta: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
  ];

  if (noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  meta.push(
    { property: "og:type", content: type },
    { property: "og:site_name", content: APP_NAME },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:card", content: cardType },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  );

  if (url) {
    meta.push({ property: "og:url", content: url });
  }
  if (resolvedImage) {
    meta.push(
      { property: "og:image", content: resolvedImage },
      { name: "twitter:image", content: resolvedImage },
    );
  }
  if (jsonLd) {
    meta.push({ "script:ld+json": jsonLd });
  }

  return meta;
}

export function embedHead(options: EmbedMetaOptions) {
  const url = options.pathname ? pageUrl(options.pathname) : undefined;

  return asRouteHead({
    meta: embedMeta(options),
    links: url ? [{ rel: "canonical", href: url }] : [],
  });
}

export function defaultSiteHead() {
  const url = pageUrl("/");

  return embedHead({
    title: APP_NAME,
    pathname: "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: APP_NAME,
      description: DEFAULT_SITE_DESCRIPTION,
      ...(url ? { url } : {}),
    },
  });
}

export function privatePageHead(title: string) {
  return asRouteHead({
    meta: embedMeta({ title, noindex: true }),
  });
}
