import { useState } from "react";

import { MINECRAFT_DEFAULT_SERVER_FAVICON } from "@/lib/minecraft-default-favicon";
import { cn } from "@/lib/utils";

type ServerFaviconProps = {
  name: string;
  favicon: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
};

const sizeClasses = {
  sm: "size-7",
  md: "size-9",
} as const;

export function ServerFavicon({
  name,
  favicon,
  size = "md",
  className,
}: ServerFaviconProps) {
  const [failed, setFailed] = useState(false);
  const src = favicon && !failed ? favicon : MINECRAFT_DEFAULT_SERVER_FAVICON;

  return (
    <div
      className={cn("server-favicon", sizeClasses[size], className)}
      aria-hidden
    >
      <img
        src={src}
        alt=""
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => {
          if (src !== MINECRAFT_DEFAULT_SERVER_FAVICON) {
            setFailed(true);
          }
        }}
      />
      <span className="sr-only">{name}</span>
    </div>
  );
}
