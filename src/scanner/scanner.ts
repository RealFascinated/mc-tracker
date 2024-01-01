import cron from "node-cron";
import { database, serverManager, websocketServer } from "..";
import Server, { ServerStatus } from "../server/server";

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
      serverManager.getServers().map((server) => this.scanServer(server))
    );

    logger.info("Finished scanning servers");
  }

  /**
   * Scans a server and inserts the ping into the database.
   *
   * @param server the server to scan
   * @returns a promise that resolves when the server has been scanned
   */
  async scanServer(server: Server): Promise<void> {
    //logger.info(`Scanning server ${server.getIP()} - ${server.getType()}`);
    let response;
    let online = false;

    try {
      response = await server.pingServer();
      if (response == undefined) {
        return; // Server is offline
      }
      online = true;
    } catch (err) {
      logger.info(`Failed to ping ${server.getIP()}`, err);
      websocketServer.sendServerError(server, ServerStatus.OFFLINE);
      return;
    }

    if (!online || !response) {
      return; // Server is offline
    }

    database.insertPing(server, response);
    const isNewRecord = database.insertRecord(server, response);

    // todo: send all server pings at once
    websocketServer.sendNewPing(server, response, isNewRecord);
  }
}
