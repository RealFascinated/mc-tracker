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
    logger.info("InfluxDB initialized");

    this.writeApi = this.influx.getWriteApi(
      Config.influx.org,
      Config.influx.bucket,
      "ms"
    );
  }

  /**
   * Write a point to the database.
   *
   * @param point the point to write
   */
  public async writePoint(point: Point): Promise<void> {
    this.writeApi.writePoint(point);
  }
}
