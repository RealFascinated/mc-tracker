import cron from "node-cron";
import { logger } from "../utils/logger";
import Server, { ServerType } from "./server";
import { env } from "@mc-tracker/common/env";
import { validate as uuidValidate } from "uuid";

import Servers from "../../../../data/servers.json";

export default class ServerManager {
  public static SERVERS: Server[] = [];

  constructor() {
    logger.info("Loading servers...");
    for (const configServer of Servers.sort((a, b) =>
      a.type.localeCompare(b.type)
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
        type: configServer.type as ServerType,
      });
      ServerManager.SERVERS.push(server);
      logger.info(
        `Loaded ${configServer.type} server ${configServer.name} - ${configServer.ip} (${configServer.id})`
      );
    }

    // Validate all server ids are unique
    const serverIds = ServerManager.SERVERS.map((server) => server.id);
    if (new Set(serverIds).size !== serverIds.length) {
      throw new Error(`Duplicate server ids found`);
    }

    logger.info(`Loaded ${ServerManager.SERVERS.length} servers!`);

    cron.schedule(env.PINGER_SERVER_CRON, async () => {
      await this.pingServers();
    });

    cron.schedule(env.PINGER_DNS_INVALIDAION_CRON, () => {
      logger.info("Invalidating DNS cache for all servers");
      for (const server of ServerManager.SERVERS) {
        server.invalidateDns();
      }
    });
  }

  /**
   * Ping all servers to update their status.
   */
  private async pingServers(): Promise<void> {
    logger.info(`Pinging servers ${ServerManager.SERVERS.length}`);

    // ping all servers in parallel
    await Promise.all(
      ServerManager.SERVERS.map((server) => server.pingServer())
    );

    logger.info("Finished pinging servers!");
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
