import {
  InfluxDB,
  Point,
  WriteApi,
} from "@influxdata/influxdb-client";

import { logger } from "../common/logger";
import { env } from "../common/env";

export default class Influx {
  private influx: InfluxDB;
  private writeApi: WriteApi;

  constructor() {
    logger.info("Loading influx database");

    this.influx = new InfluxDB({
      url: env.INFLUX_URL,
      token: env.INFLUX_TOKEN,
    });
    this.writeApi = this.influx.getWriteApi(
      env.INFLUX_ORG,
      env.INFLUX_BUCKET,
      "ms",
    );

    logger.info("InfluxDB initialized");
  }

  /**
   * Write a point to the database.
   *
   * @param point the point to write
   */
  public writePoint(point: Point) {
    this.writeApi.writePoint(point);
  }
}

/**
 * The influx database instance.
 */
export const influx = new Influx();
