const SERVER_PLATFORMS = ["PC", "PE"] as const;

export type ServerPlatform = (typeof SERVER_PLATFORMS)[number];

export type ServerPlatformFilter = "all" | ServerPlatform;

export const SERVER_PLATFORM_FILTER_OPTIONS: Array<{
  value: ServerPlatformFilter;
  shortLabel: string;
  label: string;
}> = [
  { value: "all", shortLabel: "All", label: "All platforms" },
  { value: "PC", shortLabel: "Java", label: "Java (PC)" },
  { value: "PE", shortLabel: "Bedrock", label: "Bedrock (PE)" },
];

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
