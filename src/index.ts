import Influx from "./influx/influx";
import Scanner from "./scanner/scanner";
import ServerManager from "./server/serverManager";

/**
 * The server manager instance.
 */
export const serverManager = new ServerManager();

/**
 * The influx database instance.
 */
export const influx = new Influx();

(async () => {
  await serverManager.init();

  // The scanner is responsible for scanning all servers
  new Scanner();
})();
