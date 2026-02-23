import { AsnLookup } from "mcutils-js-api/dist/types/server/server";
import type Server from "../../server/server";
import type { Ping } from "./ping";
import type { ServerType } from "./server";

export type ServerPing = { server: Server; ping: Ping };

export type ServerInfo = {
  id: string;
  name: string;
  type: ServerType;
  asnData?: AsnLookup;
};

export type ServerPingResult = {
  server: ServerInfo;
  ping: Ping;
};

export type PingProvider = () => Promise<ServerPingResult[]>;
