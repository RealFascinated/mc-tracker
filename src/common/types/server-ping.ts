import type Server from "../../server/server";
import { Server as MinecraftServer } from "mcutils-js-api/dist/types/server/server";

export type PingResult = {
  server: Server;
  ping: MinecraftServer;
};

export type PingProvider = () => Promise<PingResult[]>;
