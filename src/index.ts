import Database from "./database/database";
import Scanner from "./scanner/scanner";
import ServerManager from "./server/serverManager";
import WebsocketServer from "./websocket/websocket";

import Config from "../data/config.json";

/**
 * The database instance.
 */
export const database = new Database();

/**
 * The server manager instance.
 */
export const serverManager = new ServerManager();

/**
 * The websocket server instance.
 */
export const websocketServer = new WebsocketServer(Config.websocket.port);

(async () => {
  await serverManager.init();

  // The scanner is responsible for scanning all servers
  new Scanner();
})();

// The websocket server is responsible for
// sending data to the client in real time

// serverManager.getServers().forEach((server) => {
//   const record = database.getRecord(server.getID());
//   if (!record) {
//     return;
//   }
//   console.log(
//     `Record for "${server.getName()}": ${record.playerCount} (${formatTimestamp(
//       record.timestamp
//     )})`
//   );
// });
