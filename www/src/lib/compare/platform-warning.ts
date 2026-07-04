import type { ServerPlatform } from "@/lib/api/platform";
import type { ServerListItem } from "@/lib/api/servers";

export function comparePlatformWarning(
  servers: ServerListItem[],
): string | null {
  const platforms = new Set<ServerPlatform>();
  for (const server of servers) {
    platforms.add(server.type);
  }

  if (platforms.size <= 1) {
    return null;
  }

  return "You're comparing Java and Bedrock servers — player counts aren't directly comparable.";
}
