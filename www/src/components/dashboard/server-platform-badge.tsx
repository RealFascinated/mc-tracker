import { Badge } from "@/components/ui/badge";
import { formatServerPlatformLabel } from "@/lib/api/platform";
import type { ServerPlatform } from "@/lib/api/platform";
import { cn } from "cnfast";

function ServerPlatformBadge({
  platform,
  className,
}: {
  platform: ServerPlatform;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-[1.125rem] rounded-snug border-transparent px-1.5 text-[0.625rem] font-semibold tracking-wide",
        platform === "PE"
          ? "server-platform-badge-bedrock"
          : "server-platform-badge-java",
        className,
      )}
    >
      {formatServerPlatformLabel(platform)}
    </Badge>
  );
}

export { ServerPlatformBadge };
