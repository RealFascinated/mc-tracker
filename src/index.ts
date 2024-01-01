import Database from "./database/database";
import Scanner from "./scanner/scanner";
import ServerManager from "./server/serverManager";
import { formatTimestamp } from "./utils/timeUtils";

/**
 * The database instance.
 */
export const database = new Database();

/**
 * The server manager instance.
 */
export const serverManager = new ServerManager();

// The scanner is responsible for scanning all servers
new Scanner();

serverManager.getServers().forEach((server) => {
  const record = database.getRecord(server.getID());
  if (!record) {
    return;
  }
  console.log(
    `Record for "${server.getName()}": ${record.playerCount} (${formatTimestamp(
      record.timestamp
    )})`
  );
});
