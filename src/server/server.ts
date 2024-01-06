import javaPing from "mcping-js";
import { ResolvedServer, resolveDns } from "../utils/dnsResolver";
const bedrockPing = require("mcpe-ping-fixed"); // Doesn't have typescript definitions

import { Point } from "@influxdata/influxdb-client";
import { influx } from "..";
import Config from "../../data/config.json";
import { Ping } from "../types/ping";
import { logger } from "../utils/logger";

/**
 * The type of server.
 *
 * PC: Java Edition - PE: Bedrock Edition
 */
export type ServerType = "PC" | "PE";

type ServerOptions = {
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
   * The name of the server.
   */
  private readonly name: string;

  /**
   * The IP address of the server.
   */
  private readonly ip: string;

  /**
   * The port of the server.
   */
  private readonly port: number | undefined;

  /**
   * The type of server.
   */
  private readonly type: ServerType;

  /**
   * The resolved server information from
   * DNS records for a PC server.
   */
  private dnsInfo: DnsInfo = {
    hasResolved: false,
  };

  constructor({ name, ip, port, type }: ServerOptions) {
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
    try {
      let response;

      switch (this.getType()) {
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
          new Point("playerCount")
            .tag("name", this.getName())
            .intField("playerCount", response.playerCount)
            .timestamp(response.timestamp)
        );
      } catch (err) {
        logger.warn(`Failed to write ping to influxdb`, err);
      }

      return Promise.resolve(response);
    } catch (err) {
      logger.warn(`Failed to ping ${this.getIP()}`, err);
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
        const resolvedServer = await resolveDns(this.getIP());

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
      ip = this.getIP();
      port = 25565; // The default port
    }

    const serverPing = new javaPing.MinecraftServer(ip, port);

    return new Promise((resolve, reject) => {
      serverPing.ping(Config.pinger.timeout, 765, (err, res) => {
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
      bedrockPing(
        this.getIP(),
        this.getPort() || 19132,
        (err: any, res: any) => {
          if (err || res == undefined) {
            return reject(err);
          }

          resolve({
            timestamp: Date.now(),
            ip: this.getIP(),
            playerCount: res.currentPlayers,
          });
        }
      );
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

  /**
   * Returns the name of the server.
   *
   * @returns the name
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Returns the IP address of the server.
   *
   * @returns the IP address
   */
  public getIP(): string {
    return this.ip;
  }

  /**
   * Returns the port of the server.
   *
   * @returns the port
   */
  public getPort(): number | undefined {
    return this.port;
  }

  /**
   * Returns the type of server.
   *
   * @returns the type
   */
  public getType(): ServerType {
    return this.type;
  }
}
