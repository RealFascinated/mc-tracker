import cron from "node-cron";

import { serverManager } from "..";
import Config from "../../data/config.json";
import { logger } from "../utils/logger";

export default class Scanner {
  constructor() {
    logger.info("Loading scanner database");

    cron.schedule(Config.scanner.updateCron, () => {
      this.scanServers();
    });
  }

  /**
   * Start a server scan to ping all servers.
   */
  private async scanServers(): Promise<void> {
    logger.info(`Scanning servers ${serverManager.getServers().length}`);

    // ping all servers in parallel
    await Promise.all(
      serverManager.getServers().map((server) => server.pingServer())
    );

    logger.info("Finished scanning servers");
  }
}
