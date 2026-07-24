const SERVER_PLATFORMS = ["PC", "PE"] as const;

export type ServerPlatform = (typeof SERVER_PLATFORMS)[number];

export type ServerPlatformFilter = "all" | ServerPlatform;

export type ServerPlatformOption = {
  value: ServerPlatform;
  label: string;
  shortLabel: string;
  badgeClassName: string;
  mcutilsSlug: "java" | "bedrock";
  summaryField: "playersPc" | "playersPe";
  statsLabelClassName: string;
  emptyFiltered: string;
  emptyFilteredHint: string;
};

export const SERVER_PLATFORM_OPTIONS: ReadonlyArray<ServerPlatformOption> = [
  {
    value: "PC",
    label: "Java",
    shortLabel: "Java",
    badgeClassName: "server-platform-badge-java",
    mcutilsSlug: "java",
    summaryField: "playersPc",
    statsLabelClassName: "text-platform-java",
    emptyFiltered: "No Java servers to show.",
    emptyFilteredHint: "Switch to All or Bedrock, or track a Java server.",
  },
  {
    value: "PE",
    label: "Bedrock",
    shortLabel: "Bedrock",
    badgeClassName: "server-platform-badge-bedrock",
    mcutilsSlug: "bedrock",
    summaryField: "playersPe",
    statsLabelClassName: "text-platform-bedrock",
    emptyFiltered: "No Bedrock servers to show.",
    emptyFilteredHint: "Switch to All or Java, or track a Bedrock server.",
  },
];

export const SERVER_PLATFORM_FILTER_OPTIONS: Array<{
  value: ServerPlatformFilter;
  shortLabel: string;
  label: string;
}> = [
  { value: "all", shortLabel: "All", label: "All platforms" },
  ...SERVER_PLATFORM_OPTIONS.map(({ value, shortLabel, label }) => ({
    value,
    shortLabel,
    label,
  })),
];

export function getServerPlatform(
  platform: ServerPlatform,
): ServerPlatformOption {
  return (
    SERVER_PLATFORM_OPTIONS.find((option) => option.value === platform) ??
    SERVER_PLATFORM_OPTIONS[0]
  );
}

export function serverPlatformMcutilsSlug(type: string): "java" | "bedrock" {
  return getServerPlatform(type === "PE" ? "PE" : "PC").mcutilsSlug;
}

export function platformFilterEmptyCopy(platformFilter: ServerPlatformFilter): {
  emptyFiltered: string;
  emptyFilteredHint: string;
} {
  if (platformFilter === "all") {
    return {
      emptyFiltered: "No servers to show.",
      emptyFilteredHint: "Try a different platform filter.",
    };
  }

  const platform = getServerPlatform(platformFilter);
  return {
    emptyFiltered: platform.emptyFiltered,
    emptyFilteredHint: platform.emptyFilteredHint,
  };
}

function mixedPlatformCompareWarning(
  platforms: Set<ServerPlatform>,
): string | null {
  if (platforms.size <= 1) {
    return null;
  }

  const labels = SERVER_PLATFORM_OPTIONS.map((option) => option.label);
  return `You're comparing ${labels.join(" and ")} servers — player counts aren't directly comparable.`;
}

export function comparePlatformWarning(
  servers: Array<{ type: ServerPlatform }>,
): string | null {
  const platforms = new Set<ServerPlatform>();
  for (const server of servers) {
    platforms.add(server.type);
  }
  return mixedPlatformCompareWarning(platforms);
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
