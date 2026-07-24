import { useCallback } from "react";
import { toast } from "sonner";

import { formatServerHost } from "@/lib/api/servers";
import { cn } from "cnfast";

type ServerHostCopyProps = {
  host: string;
  port?: number | null;
  className?: string;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ServerHostCopy({ host, port, className }: ServerHostCopyProps) {
  const address = formatServerHost(host, port);

  const handleCopy = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const copied = await copyText(address);
      if (copied) {
        toast.success("Address copied");
      } else {
        toast.error("Couldn't copy address");
      }
    },
    [address],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "server-host-copy link-underline-animate link-underline-animate--primary focus-visible:ring-2 focus-visible:ring-monitor focus-visible:ring-offset-1 focus-visible:ring-offset-background dark:focus-visible:ring-warning",
        className,
      )}
      title={`Copy ${address}`}
      aria-label={`Copy server address ${address}`}
    >
      {address}
    </button>
  );
}
