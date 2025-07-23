import javaPing from "mcping-js";
import { ResolvedServer, resolveDns } from "../utils/dns-resolver";
const bedrockPing = require("mcpe-ping-fixed"); // Doesn't have typescript definitions

import { Point } from "@influxdata/influxdb-client";
import { env } from "@mc-tracker/common/env";
import { Ping } from "../types/ping";
import { logger } from "../utils/logger";
import { influx } from "../influx/influx";

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
  private dnsInfo: DnsInfo = {
    hasResolved: false,
  };

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
  public async pingServer(): Promise<Ping | undefined> {
    const before = Date.now();
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
        return Promise.resolve(undefined);
      }

      try {
        influx.writePoint(
          new Point("ping")
            .tag("id", this.id)
            .tag("name", this.name)
            .intField("playerCount", response.playerCount)
            .intField("latency", Date.now() - before)
            .stringField("type", this.type)
            .timestamp(response.timestamp)
        );
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
          playerCount: res.players.online,
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
          playerCount: res.currentPlayers,
        });
      });
    });
  }

  /**
   * Invalidates the DNS cache for the server.
   */
  public invalidateDns() {
    this.dnsInfo = {
      hasResolved: false,
    };
  }
}
