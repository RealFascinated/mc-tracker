import {
  InfluxDB,
  Point,
  QueryApi,
  WriteApi,
} from "@influxdata/influxdb-client";

import { logger } from "../common/logger";
import { env } from "../common/env";

export default class Influx {
  private influx: InfluxDB;
  private writeApi: WriteApi;
  private queryApi: QueryApi;

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
    this.queryApi = this.influx.getQueryApi(env.INFLUX_ORG);

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

  /**
   * Query the database.
   *
   * @param query the query to execute
   * @returns the query results
   */
  public query<T>(query: string): Promise<T[]> {
    return this.queryApi.collectRows(query);
  }
}

/**
 * The influx database instance.
 */
export const influx = new Influx();
