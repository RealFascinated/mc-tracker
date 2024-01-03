import Influx from "./influx/influx";
import ServerManager from "./server/serverManager";

/**
 * The influx database instance.
 */
export const influx = new Influx();

new ServerManager();
