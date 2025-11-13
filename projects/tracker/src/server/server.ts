import { Point } from "@influxdata/influxdb-client";
import { Ping } from "../types/ping";
import { logger } from "../utils/logger";
import { influx } from "../influx/influx";
import { QueryBuilder } from "../common/influx/query-builder";
import { executeQuery, InfluxQueryResultRow } from "../common/influx";
import { PingResponse } from "@mc-tracker/common/types/response/ping-response";
import { fetchJavaServer, fetchBedrockServer } from "mcutils-js-api";
import { AsnData } from "mcutils-js-api/dist/types/server/server";

/**
 * The type of server.
 *
 * PC: Java Edition - PE: Bedrock Edition
 */
export type ServerType = "PC" | "PE";

type ServerOptions = {
  id: string;
  name: string;
  ip: string;
  port?: number;
  type: ServerType;
};

export default class Server {
  /**
   * The ID of the server.
   */
  public readonly id: string;

  /**
   * The name of the server.
   */
  public readonly name: string;

  /**
   * The IP address of the server.
   */
  public readonly ip: string;

  /**
   * The port of the server.
   */
  public readonly port: number | undefined;

  /**
   * The type of server.
   */
  public readonly type: ServerType;

  /**
   * The ASN data for this server.
   */
  public asnData?: AsnData & {
    lastUpdated: Date;
  };

  /**
   * The previous ping attempt.
   */
  public previousPing: Ping | undefined;

  constructor({ id, name, ip, port, type }: ServerOptions) {
    this.id = id;
    this.name = name;
    this.ip = ip;
    this.port = port;
    this.type = type;
  }

  /**
   * Pings a server and gets the response.
   *
   * @returns the ping response or undefined if the server is offline
   */
  public async pingServer(attempt: number = 0): Promise<Ping | undefined> {
    // Allow 2 re-try attempts
    if (attempt >= 3) {
      logger.info(`Failed to ping ${this.name} after ${attempt} attempts.`);
      return undefined;
    }

    try {
      let response;

      try {
        switch (this.type) {
          case "PC": {
            response = await this.pingPCServer();
            break;
          }
          case "PE": {
            response = await this.pingPEServer();
            break;
          }
        }
      } catch {
        this.previousPing = undefined;
      }

      if (!response) {
        logger.info(
          `Server ${
            this.name
          } failed to respond to ping attempt, retrying... (attempt ${
            attempt + 1
          })`
        );
        await Bun.sleep(50); // 50ms delay between attempts
        return this.pingServer(attempt + 1);
      }

      try {
        const point = new Point("ping")
          .tag("id", this.id)
          .tag("name", this.name + " (" + this.type + ")")
          .intField("playerCount", response.playerCount)
          .stringField("type", this.type)
          .timestamp(response.timestamp);

        if (this.asnData?.asn) {
          point.tag("asn", this.asnData.asn);
          point.tag("asnOrg", this.asnData.asnOrg);
        }

        influx.writePoint(point);
      } catch (err) {
        logger.warn(
          `Failed to write point to Influx for ${this.name} - ${this.ip}`,
          err
        );
      }

      return Promise.resolve(response);
    } catch (err) {
      logger.warn(`Failed to ping ${this.ip}`, err);
      return Promise.resolve(undefined);
    }
  }

  /**
   * Pings a PC server and gets the response.
   *
   * @param server the server to ping
   * @returns the ping response or undefined if the server is offline
   */
  private async pingPCServer(): Promise<Ping | undefined> {
    const response = await fetchJavaServer(`${this.ip}:${this.port ?? 25565}`);
    const { server, error } = response;
    if (error || !server) {
      this.previousPing = undefined;
      return undefined;
    }
    this.updateAsnData(server.asn);

    const ping = {
      ip: server.ip,
      playerCount: server.players.online,
      timestamp: Date.now(),
    } as Ping;

    this.previousPing = ping;
    return ping;
  }

  /**
   * Pings a PE server and gets the response.
   *
   * @param server the server to ping
   * @returns the ping response or undefined if the server is offline
   */
  private async pingPEServer(): Promise<Ping | undefined> {
    const response = await fetchBedrockServer(
      `${this.ip}:${this.port ?? 19132}`
    );
    const { server, error } = response;
    if (error || !server) {
      this.previousPing = undefined;
      return undefined;
    }
    this.updateAsnData(server.asn);

    return {
      ip: server.ip,
      playerCount: server.players.online,
      timestamp: Date.now(),
    };
  }

  /**
   * Updates the cached asn data.
   *
   * @param data the new asn data
   */
  private updateAsnData(data: AsnData) {
    // If no data, ignore the update
    if (!data) {
      return;
    }

    // Update if more than 3 hours ago
    if (this.asnData && this.asnData.lastUpdated) {
      const sixHoursInMs = 3 * 60 * 60 * 1000;
      const timeSinceUpdate = Date.now() - this.asnData.lastUpdated.getTime();

      if (timeSinceUpdate < sixHoursInMs) {
        return; // Data is still fresh, no need to update
      }
    }

    this.asnData = {
      ...data,
      lastUpdated: new Date(),
    };
  }

  /**
   * Gets the pings for the server.
   *
   * @returns the pings
   */
  public async getPings(): Promise<PingResponse[]> {
    const query = new QueryBuilder()
      .rangeWithMinMax("-1h", "now()")
      .filterByField("measurement", "ping")
      .filterByField("field", "playerCount")
      .filterByTag("id", this.id)
      .aggregateWindow("1m", "mean", true)
      .yield("mean")
      .build();

    const pings = await executeQuery<InfluxQueryResultRow>(query);
    return pings.data
      .map((ping) => ({
        timestamp: new Date(ping.timestamp).getTime(),
        playerCount: ping.value as number,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}
