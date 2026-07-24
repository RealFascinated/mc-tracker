import { getServerPlatform, type ServerPlatform } from "@/lib/api/platform";

export type MonitoredServerEventType =
  | "added"
  | "removed"
  | "paused"
  | "unpaused";

export type MonitoredServerEvent = {
  id: string;
  serverId: string;
  serverName: string;
  type: ServerPlatform;
  eventType: MonitoredServerEventType;
  occurredAt: number;
};

const EVENT_VERBS: Record<MonitoredServerEventType, string> = {
  added: "Added",
  removed: "Removed",
  paused: "Paused",
  unpaused: "Unpaused",
};

export function formatMonitoredServerEventLabel(
  event: Pick<MonitoredServerEvent, "eventType" | "serverName" | "type">,
): string {
  const platform = getServerPlatform(event.type).shortLabel;
  return `${EVENT_VERBS[event.eventType]}: ${event.serverName} (${platform})`;
}
