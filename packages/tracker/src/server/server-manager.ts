import cron from "node-cron";
import { logger } from "../utils/logger";
import Server, { ServerType } from "./server";

import { env } from "@mc-tracker/common/env";
import Servers from "../../../../data/servers.json";

export default class ServerManager {
  private servers: Server[] = [];

  constructor() {
    logger.info("Loading servers...");
    for (const configServer of Servers) {
      const server = new Server({
        ip: configServer.ip,
        name: configServer.name,
        type: configServer.type as ServerType,
      });
      this.servers.push(server);
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
