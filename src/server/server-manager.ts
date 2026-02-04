import { readFileSync } from "fs";
import { join } from "path";
import { validate as uuidValidate } from "uuid";
import { logger } from "../common/logger";
import type { ServerConfig } from "../common/types/server";
import { PingResult } from "../common/types/server-ping";
import Server from "./server";

export default class ServerManager {
  public static SERVERS: Server[] = [];
  private static pingPromise: Promise<PingResult[]> | null = null;

  constructor() {
    logger.info("Loading servers...");
    const Servers = ServerManager.loadServers();

    for (const configServer of Servers.sort((a, b) =>
      a.type.localeCompare(b.type),
    )) {
      // Validate server id is a valid uuid
      if (!uuidValidate(configServer.id)) {
        throw new Error(`Invalid server id: ${configServer.id}`);
      }

      // Validate server type is valid
      if (!["PC", "PE"].includes(configServer.type)) {
        throw new Error(`Invalid server type: ${configServer.type}`);
      }

      const server = new Server({
        id: configServer.id,
        ip: configServer.ip,
        name: configServer.name,
        type: configServer.type,
      });
      ServerManager.SERVERS.push(server);
      logger.info(`Loaded ${server.getIdentifier()} (${configServer.id})`);
    }

    // Validate all server ids are unique
    const serverIds = ServerManager.SERVERS.map((server) => server.id);
    if (new Set(serverIds).size !== serverIds.length) {
      throw new Error(`Duplicate server ids found`);
    }

    logger.info(`Loaded ${ServerManager.SERVERS.length} servers!`);
  }

  /**
   * Load the servers from the servers.json file.
   *
   * @returns the servers
   */
  private static loadServers(): ServerConfig[] {
    const serversPath = join(process.cwd(), "data", "servers.json");

    try {
      const fileContent = readFileSync(serversPath, "utf-8");
      return JSON.parse(fileContent) as ServerConfig[];
    } catch (error) {
      throw new Error(
        `Failed to load servers.json from ${serversPath}: ${error}`,
      );
    }
  }

  /**
   * Ping all servers and return successful results.
   * Concurrent calls share the same in-flight ping.
   */
  public async getServerPings(): Promise<PingResult[]> {
    if (ServerManager.pingPromise) {
      return ServerManager.pingPromise;
    }

    ServerManager.pingPromise = this.executePings();
    try {
      return await ServerManager.pingPromise;
    } finally {
      ServerManager.pingPromise = null;
    }
  }

  private async executePings(): Promise<PingResult[]> {
    logger.info(`Pinging servers ${ServerManager.SERVERS.length}`);

    const pings = await Promise.all(
      ServerManager.SERVERS.map(async (server) => {
        try {
          const ping = await server.pingServer();
          if (!ping) {
            return undefined;
          }
          return {
            server,
            ping,
          } as PingResult;
        } catch (err) {
          // Ignore the error, continue fetching servers
        }
      }),
    );

    const results = pings.filter((p): p is PingResult => p !== undefined);

    logger.info(
      `Finished pinging servers! ${results.length}/${ServerManager.SERVERS.length} servers responded to ping!`,
    );

    return results;
  }

  /**
   * Get a server by its id.
   *
   * @param id the id of the server
   * @returns the server or undefined if not found
   */
  public static getServerById(id: string): Server | undefined {
    for (const server of ServerManager.SERVERS) {
      if (server.id === id) {
        return server;
      }
    }

    return undefined;
  }
}
