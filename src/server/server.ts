import javaPing from "mcping-js";
import { ResolvedServer, resolveDns } from "../common/dns-resolver";
import dns from "dns";
const bedrockPing = require("mcpe-ping-fixed"); // Doesn't have typescript definitions

import { Point } from "@influxdata/influxdb3-client";
import { influx } from "../influx/influx";
import { env } from "../common/env";
import { Ping } from "../common/types/ping";
import { logger } from "../common/logger";
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

  /**
   * This is used for when a server doesn't respond to a
   * ping so we can fallback if they fail to respond to 1 ping.
   */
  public previousPing?: Ping;

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

        await Bun.sleep(500);
        return this.pingServer(attempt + 1);
      }

      // If the server failed to respond to the ping, return the previous ping
      const ping = this.previousPing;
      if (ping) {
        logger.warn(
          `Failed to ping ${this.ip} after ${Math.round(performance.now() - before)}ms, using fallback ping`,
        );
        this.previousPing = undefined; // Clear the previous ping
        return Promise.resolve(ping);
      }

      return Promise.resolve(undefined); // No ping data to return
    }

    // Update ASN data if needed
    await this.updateAsnData(response.ip);

    try {
      const point = Point.measurement("ping")
        .setTag("id", this.id)
        .setTag("name", this.name)
        .setTag("type", this.type)
        .setIntegerField("player_count", response.playerCount)
        .setTimestamp(new Date(response.timestamp));

      if (this.asnData?.asn && this.asnData?.asnOrg) {
        point.setTag("asn", this.asnData.asn);
        point.setTag("asn_org", this.asnData.asnOrg);
      }

      influx.writePoint(point);
    } catch (err) {
      logger.warn(
        `Failed to write point to Influx for ${this.name} - ${this.ip}`,
        err,
      );
    }

    this.previousPing = response; // Update the previous ping
    return Promise.resolve(response);
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
      } catch (err) { }
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
          return resolve(undefined);
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
          return resolve(undefined);
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
}
