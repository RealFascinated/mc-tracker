import { cn } from "@/lib/utils";

type ServerPlatformBadgeProps = {
  type: string;
  className?: string;
};

export function ServerPlatformBadge({
  type,
  className,
}: ServerPlatformBadgeProps) {
  return (
    <span
      className={cn(
        "server-platform-badge",
        type === "PE" && "server-platform-badge-pe",
        className,
      )}
    >
      {type}
    </span>
  );
}
