import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetricTimeWindowLinkSearch } from "@/hooks/metrics/use-metric-time-window-link-search";
import {
  asnDetailSearch,
  asnDisplayName,
  type AsnDetailResponse,
} from "@/lib/api/asns";
import { asnQueryOptions } from "@/lib/api/asns.queries";
import { formatLocaleInteger, formatPlayers } from "@/lib/formatter";
import { cn } from "cnfast";

type AsnHoverPreviewProps = {
  asn: string;
  asnOrg: string;
  label: string;
  className?: string;
};

type AsnHoverPreviewContentProps = {
  asn: string;
  label: string;
  isPending: boolean;
  isError: boolean;
  data?: AsnDetailResponse;
};

function AsnHoverPreviewContent({
  asn,
  label,
  isPending,
  isError,
  data,
}: AsnHoverPreviewContentProps) {
  const displayName = data ? asnDisplayName(data) : label;
  const asnNumber = data?.asn ?? asn;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="min-w-0 space-y-0.5">
        {isPending ? (
          <>
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <p className="truncate font-medium text-popover-foreground">
              {displayName}
            </p>
            <p className="text-muted-foreground">{asnNumber}</p>
          </>
        )}
      </div>

      {isPending ? (
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : isError || !data ? (
        <p className="text-muted-foreground">Stats unavailable</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <dt className="text-muted-foreground">Players</dt>
            <dd className="font-medium tabular-nums">
              {formatPlayers(data.playersOnline)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Servers</dt>
            <dd className="font-medium tabular-nums">
              {formatLocaleInteger(data.serverCount)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Peak 24h</dt>
            <dd className="font-medium tabular-nums">
              {formatPlayers(data.peaks.players24h)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

export function AsnHoverPreview({
  asn,
  asnOrg,
  label,
  className,
}: AsnHoverPreviewProps) {
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const [open, setOpen] = useState(false);
  const { data, isPending, isError } = useQuery({
    ...asnQueryOptions(asn, asnOrg),
    enabled: open,
  });

  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={250}
      closeDelay={100}
    >
      <HoverCardTrigger asChild>
        <Link
          to="/asns/$asn"
          params={{ asn }}
          search={asnDetailSearch(asnOrg, timeWindowSearch)}
          className={cn(
            "link-underline-animate link-underline-animate--primary hover:text-monitor dark:hover:text-warning",
            className,
          )}
        >
          {label}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-56">
        <AsnHoverPreviewContent
          asn={asn}
          label={label}
          isPending={isPending}
          isError={isError}
          data={data}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
