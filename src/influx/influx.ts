import { InfluxDB, Point, WriteApi } from "@influxdata/influxdb-client";

import Config from "../../data/config.json";
import { logger } from "../utils/logger";

export default class Influx {
  private influx: InfluxDB;
  private writeApi: WriteApi;

  constructor() {
    logger.info("Loading influx database");

    this.influx = new InfluxDB({
      url: Config.influx.url,
      token: Config.influx.token,
    });
    this.writeApi = this.influx.getWriteApi(
      Config.influx.org,
      Config.influx.bucket,
      "ms"
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
