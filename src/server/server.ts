import { ResolvedServer, resolveDns } from "../utils/dnsResolver";
import JavaPing = require("mcping-js");

import Config from "../../data/config.json";

/**
 * The type of server.
 *
 * PC: Java Edition - PE: Bedrock Edition
 */
export type ServerType = "PC" | "PE";

/**
 * The response from a ping request to a server.
 */
export type PingResponse = {
  timestamp: number;
  ip: string;
  version: string;
  players: {
    online: number;
    max: number;
  };
};

type ServerOptions = {
  id: number;
  name: string;
  ip: string;
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
  private id: number;

  /**
   * The name of the server.
   */
  private name: string;

  /**
   * The IP address of the server.
   */
  private ip: string;

  /**
   * The type of server.
   */
  private type: ServerType;

  /**
   * The resolved server information from
   * DNS records for a PC server.
   */
  private dnsInfo: DnsInfo = {
    hasResolved: false,
  };

  constructor({ id, name, ip, type }: ServerOptions) {
    this.id = id;
    this.name = name;
    this.ip = ip;
    this.type = type;
  }

  /**
   * Pings a server and gets the response.
   *
   * @param server the server to ping
   * @returns the ping response or undefined if the server is offline
   */
  public pingServer(server: Server): Promise<PingResponse | undefined> {
    switch (server.getType()) {
      case "PC": {
        return this.pingPCServer(server);
      }
      case "PE": {
        return this.pingPEServer(server);
      }
      default: {
        throw new Error(
          `Unknown server type ${server.getType()} for ${server.getName()}`
        );
      }
    }
  }

  /**
   * Pings a PC server and gets the response.
   *
   * @param server the server to ping
   * @returns the ping response or undefined if the server is offline
   */
  private async pingPCServer(
    server: Server
  ): Promise<PingResponse | undefined> {
    if (this.dnsInfo.resolvedServer == undefined && !this.dnsInfo.hasResolved) {
      try {
        const resolvedServer = await resolveDns(server.getIP());

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
      ip = server.getIP();
      port = 25565; // The default port
    }

    const serverPing = new JavaPing.MinecraftServer(ip, port);

    return new Promise((resolve, reject) => {
      serverPing.ping(Config.scanner.timeout, 700, (err, res) => {
        if (err || res == undefined) {
          return reject(err);
        }

        resolve({
          timestamp: Date.now(),
          ip: ip,
          version: res.version.name,
          players: {
            online: res.players.online,
            max: res.players.max,
          },
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
  private async pingPEServer(
    server: Server
  ): Promise<PingResponse | undefined> {
    return undefined;
  }

  /**
   * Returns the ID of the server.
   *
   * @returns the ID
   */
  public getID(): number {
    return this.id;
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
   * Returns the type of server.
   *
   * @returns the type
   */
  public getType(): ServerType {
    return this.type;
  }
}
