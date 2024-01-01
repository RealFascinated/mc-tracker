import { Socket, Server as SocketServer } from "socket.io";
import { serverManager } from "..";
import Server, { ServerStatus } from "../server/server";
import { Ping } from "../types/ping";
import { logger } from "../utils/logger";

export default class WebsocketServer {
  private server: SocketServer;

  constructor(port: number) {
    logger.info(`Starting websocket server on port ${port}`);
    this.server = new SocketServer(port);

    this.server.on("connection", (socket) => {
      logger.debug("ws: Client connected");
      this.sendServerList(socket);
    });
  }

  /**
   * Sends the server list to the given socket.
   *
   * @param socket the socket to send the server list to
   */
  public sendServerList(socket: Socket): void {
    logger.debug(`ws: Sending server list to ${socket.id}`);

    const servers = [];
    for (const server of serverManager.getServers()) {
      servers.push({
        id: server.getID(),
        name: server.getName(),
        ip: server.getIP(),
        port: server.getPort(),
        favicon: server.getFavicon(),
      });
    }
    socket.emit("serverList", servers);
  }

  /**
   * Sends the latest ping data for the given server to all clients.
   *
   * @param server the server to send the ping for
   * @param pingResponse the ping data to send
   * @param isNewRecord whether a new record has been set
   */
  public sendNewPing(
    server: Server,
    pingResponse: Ping,
    isNewRecord: boolean
  ): void {
    logger.debug(`ws: Sending new ping for ${server.getName()}`);
    this.server.emit("newPing", {
      server: server.getID(),
      timestamp: pingResponse.timestamp,
      playerCount: pingResponse.playerCount,
    });
    if (isNewRecord) {
      logger.debug(`ws: Sending new record for ${server.getName()}`);
      this.server.emit("newRecord", {
        server: server.getID(),
        timestamp: pingResponse.timestamp,
        playerCount: pingResponse.playerCount,
      });
    }
  }

  /**
   * Sends the server status for the given server to all clients.
   *
   * @param server the server to send the status for
   * @param status the status to send
   */
  public sendServerError(server: Server, status: ServerStatus): void {
    logger.debug(`ws: Sending server status for ${server.getName()}`);
    this.server.emit("serverStatus", {
      server: server.getID(),
      status: status,
    });
  }
}
