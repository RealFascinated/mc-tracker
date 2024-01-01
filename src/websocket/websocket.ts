import { Server } from "socket.io";
import { logger } from "../utils/logger";

export default class WebsocketServer {
  private server: Server;

  constructor(port: number) {
    logger.info(`Starting websocket server on port ${port}`);
    this.server = new Server(port);

    this.server.on("connection", (socket) => {
      logger.info("ws: Client connected");

      // todo: send ping data to client
    });
  }
}
