export type MonitoredServerEventType =
  | "added"
  | "removed"
  | "paused"
  | "unpaused";

export type MonitoredServerEvent = {
  id: string;
  serverId: string;
  serverName: string;
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
  event: Pick<MonitoredServerEvent, "eventType" | "serverName">,
): string {
  return `${EVENT_VERBS[event.eventType]}: ${event.serverName}`;
}
