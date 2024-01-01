import Server, { ServerType } from "./server";

import Servers from "../../data/servers.json";

export default class ServerManager {
  private servers: Server[] = [];

  constructor() {}

  /**
   * Loads the servers from the config file.
   */
  async init() {
    for (const configServer of Servers) {
      const server = new Server({
        id: configServer.id,
        ip: configServer.ip,
        name: configServer.name,
        type: configServer.type as ServerType,
      });
      try {
        await server.pingServer();
      } catch (err) {}
      this.servers.push(server);
    }
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
