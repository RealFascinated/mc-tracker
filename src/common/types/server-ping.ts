import type Server from "../../server/server";
import type { Ping } from "./ping";
import type { ServerType } from "./server";
import type { AsnData } from "./asn";

export type ServerPing = { server: Server; ping: Ping };

export type ServerInfo = {
  id: string;
  name: string;
  type: ServerType;
  asnData?: AsnData;
};

export type ServerPingResult = {
  server: ServerInfo;
  ping: Ping;
};

export type PingProvider = () => Promise<ServerPingResult[]>;
