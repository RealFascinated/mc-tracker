import javaPing from "mcping-js";
import { ResolvedServer, resolveDns } from "../common/dns-resolver";
import dns from "dns";
const bedrockPing = require("mcpe-ping-fixed"); // Doesn't have typescript definitions

import { Point } from "@influxdata/influxdb-client";
import { influx } from "../influx/influx";
import { env } from "../common/env";
import { Ping } from "../common/types/ping";
import { logger } from "../common/logger";
import { QueryBuilder } from "../common/influx/query-builder";
import { executeQuery, InfluxQueryResultRow } from "../common/influx";
import { PingResponse } from "../common/types/response/ping-response";
import { isIpAddress } from "../common/utils";
import { AsnData, MaxMindService } from "../service/maxmind-service";

const MAX_PING_ATTEMPTS = 2;

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

type DnsInfo = {
  hasResolved: boolean;
  resolvedServer?: ResolvedServer;
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
   * The resolved server information from
   * DNS records for a PC server.
   */
  public dnsInfo: DnsInfo = {
    hasResolved: false,
  };

  /**
   * The ASN data for this server.
   */
  public asnData?: AsnData & {
    lastUpdated: Date;
  };

  constructor({ id, name, ip, port, type }: ServerOptions) {
    this.id = id;
    this.name = name;
    this.ip = ip;
    this.port = port;
    this.type = type;
  }

  /**
   * Invalidates the DNS cache for the server.
   */
  public invalidateDns() {
    this.dnsInfo = {
      hasResolved: false,
    };
  }

  /**
   * Pings a server and gets the response.
   *
   * @returns the ping response or undefined if the server is offline
   */
  public async pingServer(attempt: number = 0): Promise<Ping | undefined> {
    const before = performance.now();
    try {
      let response;

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
      if (!response) {
        // Try to ping the server again if it failed
        if (attempt < MAX_PING_ATTEMPTS) {
          logger.warn(
            `Failed to ping ${this.ip} after ${Math.round(performance.now() - before)}ms, retrying... (attempt ${attempt + 1}/${MAX_PING_ATTEMPTS})`,
          );
          return this.pingServer(attempt + 1);
        }
        return Promise.resolve(undefined);
      }

      // Update ASN data if needed
      await this.updateAsnData(response.ip);

      try {
        const point = new Point("ping")
          .tag("id", this.id)
          .tag("name", this.name + " (" + this.type + ")")
          .intField("playerCount", response.playerCount)
          .stringField("type", this.type)
          .timestamp(response.timestamp);

        if (this.asnData?.asn && this.asnData?.asnOrg) {
          point.tag("asn", this.asnData.asn);
          point.tag("asnOrg", this.asnData.asnOrg);
        }

        influx.writePoint(point);
      } catch (err) {
        logger.warn(
          `Failed to write point to Influx for ${this.name} - ${this.ip}`,
          err,
        );
      }

      return Promise.resolve(response);
    } catch (err) {
      logger.warn(
        `Failed to ping ${this.ip}: "${err}" after ${Math.round(performance.now() - before)}ms`,
      );
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
    if (this.dnsInfo.resolvedServer == undefined && !this.dnsInfo.hasResolved) {
      try {
        const resolvedServer = await resolveDns(this.ip);

        this.dnsInfo = {
          hasResolved: true,
          resolvedServer: resolvedServer,
        };
      } catch (err) {}
    }

    const { hasResolved, resolvedServer } = this.dnsInfo;

    let ip: string;
    let port: number;

    if (hasResolved && resolvedServer != undefined) {
      ip = resolvedServer.ip;
      port = resolvedServer.port;
    } else {
      ip = this.ip;
      port = 25565; // The default port
    }

    const serverPing = new javaPing.MinecraftServer(ip, port);

    // todo: do something to get the latest protocol? (is this even needed??)
    return new Promise((resolve, reject) => {
      serverPing.ping(env.PINGER_TIMEOUT, 765, (err, res) => {
        if (err || res == undefined) {
          return reject(err);
        }

        resolve({
          timestamp: Date.now(),
          ip: ip,
          playerCount: Number(res.players.online),
        });
      });
    });
  }

  /**
   * Pings a PE server and gets the response.
   *
   * @param server the server to ping
   * @returns the ping response or undefined if the server is offline
   */
  private async pingPEServer(): Promise<Ping | undefined> {
    return new Promise((resolve, reject) => {
      bedrockPing(this.ip, this.port || 19132, (err: any, res: any) => {
        if (err || res == undefined) {
          return reject(err);
        }

        resolve({
          timestamp: Date.now(),
          ip: this.ip,
          playerCount: Number(res.currentPlayers),
        });
      });
    });
  }

  /**
   * Updates the cached ASN data.
   *
   * @param ipOrDomain the IP address or domain name to resolve
   */
  private async updateAsnData(ipOrDomain: string) {
    // Update if more than 3 hours ago or if not set
    if (this.asnData && this.asnData.lastUpdated) {
      const threeHoursInMs = 3 * 60 * 60 * 1000;
      const timeSinceUpdate = Date.now() - this.asnData.lastUpdated.getTime();

      if (timeSinceUpdate < threeHoursInMs) {
        return; // Data is still fresh, no need to update
      }
    }

    // Resolve domain name to IP if needed
    let ip = ipOrDomain;
    if (!isIpAddress(ipOrDomain)) {
      try {
        const resolved = await this.resolveDomainToIp(ipOrDomain);
        if (resolved) {
          ip = resolved;
        } else {
          logger.warn(
            `Failed to resolve domain ${ipOrDomain} to IP, skipping ASN lookup`,
          );
          return;
        }
      } catch (err) {
        logger.warn(`Failed to resolve domain ${ipOrDomain} to IP`, err);
        return;
      }
    }

    const asnData = MaxMindService.resolveAsn(ip);
    if (asnData) {
      this.asnData = {
        ...asnData,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Resolves a domain name to an IP address.
   *
   * @param domain the domain name to resolve
   * @returns the IP address or undefined if failed
   */
  private async resolveDomainToIp(domain: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      dns.lookup(
        domain,
        (err: NodeJS.ErrnoException | null, address: string) => {
          if (err) {
            resolve(undefined);
          } else {
            resolve(address);
          }
        },
      );
    });
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
