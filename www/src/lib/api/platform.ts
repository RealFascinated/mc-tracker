const SERVER_PLATFORMS = ["PC", "PE"] as const;

export type ServerPlatform = (typeof SERVER_PLATFORMS)[number];

export type ServerPlatformFilter = "all" | ServerPlatform;

export const SERVER_PLATFORM_FILTER_OPTIONS: Array<{
  value: ServerPlatformFilter;
  shortLabel: string;
  label: string;
}> = [
  { value: "all", shortLabel: "All", label: "All platforms" },
  { value: "PC", shortLabel: "Java", label: "Java" },
  { value: "PE", shortLabel: "Bedrock", label: "Bedrock" },
];

export function formatServerPlatformLabel(platform: ServerPlatform): string {
  return platform === "PE" ? "Bedrock" : "Java";
}

export function serverPlatformBadgeClassName(platform: ServerPlatform): string {
  return platform === "PE"
    ? "server-platform-badge server-platform-badge-bedrock"
    : "server-platform-badge server-platform-badge-java";
}

export function parseServerPlatformFilterParam(
  value: unknown,
): ServerPlatformFilter | undefined {
  if (value === "PC" || value === "PE") {
    return value;
  }
  return undefined;
}

export function filterServersByPlatform<T extends { type: ServerPlatform }>(
  servers: T[],
  platform: ServerPlatformFilter,
): T[] {
  if (platform === "all") {
    return servers;
  }
  return servers.filter((server) => server.type === platform);
}
