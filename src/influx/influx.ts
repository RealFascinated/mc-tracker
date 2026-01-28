import { InfluxDBClient, Point } from "@influxdata/influxdb3-client";

import { logger } from "../common/logger";
import { env } from "../common/env";

export default class Influx {
  private influx: InfluxDBClient;

  constructor() {
    logger.info("Loading influx database");

    this.influx = new InfluxDBClient({
      host: env.INFLUX_URL,
      token: env.INFLUX_TOKEN,
      database: env.INFLUX_DATABASE,
    });

    logger.info("InfluxDB initialized");
  }

  /**
   * Write a point to the database.
   *
   * @param point the point to write
   */
  public writePoint(point: Point) {
    this.influx.write(point);
  }
}

/**
 * The influx database instance.
 */
export const influx = new Influx();
