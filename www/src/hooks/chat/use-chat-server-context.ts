import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import type { ChatContextServer } from "@/lib/api/chat";
import { serverQueryOptions } from "@/lib/api/servers.queries";

export function useChatServerContext(): ChatContextServer | undefined {
  const serverId = useRouterState({
    select: (state) => {
      const match = /^\/servers\/([^/]+)$/.exec(state.location.pathname);
      return match?.[1];
    },
  });
  const { data } = useQuery({
    ...serverQueryOptions(serverId ?? ""),
    enabled: !!serverId,
  });
  if (!serverId || !data?.name) {
    return undefined;
  }
  return { serverId, serverName: data.name };
}
