import cron from "node-cron";
import { logger } from "../utils/logger";
import Server, { ServerType } from "./server";
import { env } from "@mc-tracker/common/env";
import { validate as uuidValidate } from "uuid";

import Servers from "../../../../data/servers.json";

export default class ServerManager {
  private servers: Server[] = [];

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
      this.servers.push(server);
      logger.info(
        `Loaded ${configServer.type} server ${configServer.name} - ${configServer.ip} (${configServer.id})`
      );
    }

    // Validate all server ids are unique
    const serverIds = this.servers.map((server) => server.id);
    if (new Set(serverIds).size !== serverIds.length) {
      throw new Error(`Duplicate server ids found`);
    }

    logger.info(`Loaded ${this.servers.length} servers!`);

    cron.schedule(env.PINGER_SERVER_CRON, async () => {
      await this.pingServers();
    });

    cron.schedule(env.PINGER_DNS_INVALIDAION_CRON, () => {
      logger.info("Invalidating DNS cache for all servers");
      for (const server of this.servers) {
        server.invalidateDns();
      }
    });
  }

  /**
   * Ping all servers to update their status.
   */
  private async pingServers(): Promise<void> {
    logger.info(`Pinging servers ${this.servers.length}`);

    // ping all servers in parallel
    await Promise.all(this.servers.map((server) => server.pingServer()));

    logger.info("Finished pinging servers!");
  }
}
