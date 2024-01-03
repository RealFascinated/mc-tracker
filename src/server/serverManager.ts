import Server, { ServerType } from "./server";

import Servers from "../../data/servers.json";
import { logger } from "../utils/logger";

export default class ServerManager {
  private servers: Server[] = [];

  constructor() {}

  /**
   * Loads the servers from the config file.
   */
  async init() {
    logger.info("Loading servers");
    for (const configServer of Servers) {
      const server = new Server({
        id: configServer.id,
        ip: configServer.ip,
        name: configServer.name,
        type: configServer.type as ServerType,
      });
      this.servers.push(server);
    }
    logger.info(`Loaded ${this.servers.length} servers`);
  }

  /**
   * Returns the servers.
   *
   * @returns the servers
   */
  public getServers(): Server[] {
    return this.servers;
  }
}
