import Server, { ServerType } from "./server";

import Servers from "../../data/servers.json";

export default class ServerManager {
  private servers: Server[] = [];

  constructor() {
    for (const server of Servers) {
      this.servers.push(
        new Server({
          id: server.id,
          ip: server.ip,
          name: server.name,
          type: server.type as ServerType,
        })
      );
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
