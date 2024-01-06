import Influx from "./influx/influx";
import ServerManager from "./server/serverManager";
import WebsiteManager from "./website/websiteManager";
import {logger} from "./utils/logger";

/**
 * The influx database instance.
 */
export const influx = new Influx();

new ServerManager();
new WebsiteManager();

logger.info("Done loading!");