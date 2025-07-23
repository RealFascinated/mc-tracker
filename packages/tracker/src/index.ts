import Influx from "./influx/influx";
import ServerManager from "./server/server-manager";
import { logger } from "./utils/logger";

/**
 * The influx database instance.
 */
export const influx = new Influx();

new ServerManager();

logger.info("Done loading!");