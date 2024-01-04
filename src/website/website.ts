import { Point } from "@influxdata/influxdb-client";
import axios from "axios";
import { influx } from "..";
import { logger } from "../utils/logger";

import Config from "../../data/config.json";

type WebsiteOptions = {
  name: string;
  url: string;
};

export default class Website {
  /**
   * The name of the website.
   */
  private name: string;

  /**
   * The url of the website.
   */
  private url: string;

  constructor({ name, url }: WebsiteOptions) {
    this.name = name;
    this.url = url;
  }

  /**
   * Pings a website and gets the response.
   *
   * @returns the response
   */
  public async pingWebsite(): Promise<void> {
    try {
      const before = Date.now();
      const response = await axios.get(this.url, {
        validateStatus: () => true, // Don't throw a error on non-200 status codes
        timeout: Config.pinger.timeout,
      });
      if (response.status === 500) {
        throw new Error("Server returned 500 status code");
      }

      const responseTime = Date.now() - before;

      influx.writePoint(
        new Point("websiteStatus")
          .tag("name", this.name)
          .booleanField("online", true)
          .intField("responseTime", responseTime)
          .timestamp(Date.now())
      );
    } catch (err) {
      logger.warn(`Failed to ping ${this.name}:`, err);
      influx.writePoint(
        new Point("websiteStatus")
          .tag("name", this.name)
          .booleanField("online", false)
          .timestamp(Date.now())
      );
    }
  }
}
