import { Badge } from "@/components/ui/badge";
import { getServerPlatform } from "@/lib/api/platform";
import type { ServerPlatform } from "@/lib/api/platform";
import { cn } from "cnfast";

function ServerPlatformBadge({
  platform,
  className,
}: {
  platform: ServerPlatform;
  className?: string;
}) {
  const config = getServerPlatform(platform);

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-[1.125rem] rounded-snug border-transparent px-1.5 text-[0.625rem] font-semibold tracking-wide",
        config.badgeClassName,
        className,
      )}
    >
      {config.label}
    </Badge>
  );
}

export { ServerPlatformBadge };
