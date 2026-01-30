
import { ResolvedServer, resolveDns } from "../common/dns-resolver";
import dns from "dns";
import { Ping } from "../common/types/ping";
import { env } from "../common/env";
import { logger } from "../common/logger";
import { isIpAddress } from "../common/utils";
import { AsnData, MaxMindService } from "../service/maxmind-service";
import { pingPC, pingPE } from "../common/minecraft-ping";

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
  public asnData?: AsnData;

  /**
   * This is used for when a server doesn't respond to a
   * ping so we can fallback if they fail to respond to 1 ping.
   */
  public previousPing?: Ping;

  /**
   * When true, this server has been determined to require fallback ping
   * (regular ping fails). Skip retries and use cached previousPing directly.
   */
  private requiresFallbackPing: boolean = false;

  constructor({ id, name, ip, port, type }: ServerOptions) {
    this.id = id;
    this.name = name;
    this.ip = ip;
    this.port = port;
    this.type = type;
  }

  /**
   * Returns a formatted identifier for logging: <name> (<type>)
   */
  public getIdentifier(): string {
    return `${this.name} (${this.type})`;
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
      // Server already requires fallback: use cached ping directly, no retries
      if (this.requiresFallbackPing && this.previousPing) {
        await this.updateAsnData(this.previousPing.ip);
        return Promise.resolve(this.previousPing);
      }

      let response: Ping | undefined;

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
        // Try to ping the server again if it failed (only for first-time discovery)
        if (attempt < env.PINGER_RETRY_ATTEMPTS) {
          logger.warn(
            `Failed to ping ${this.getIdentifier()} after ${Math.round(performance.now() - before)}ms, retrying... (attempt ${attempt + 1}/${env.PINGER_RETRY_ATTEMPTS})`,
          );

          await Bun.sleep(env.PINGER_RETRY_DELAY);
          return this.pingServer(attempt + 1);
        }

        // If the server failed to respond to the ping, return the previous ping
        const ping = this.previousPing;
        if (ping) {
          logger.warn(
            `Failed to ping ${this.getIdentifier()} after ${Math.round(performance.now() - before)}ms, using fallback ping`,
          );
          this.requiresFallbackPing = true; // Skip retries on future ping cycles
          response = ping;
        }

        if (!response) {
          return Promise.resolve(undefined);
        }
      }

      // Update ASN data if needed
      await this.updateAsnData(response.ip);

      // Update the previous ping
      this.previousPing = response;

      return Promise.resolve(response);
    } catch (err) {
      logger.warn(
        `Failed to ping ${this.getIdentifier()} after ${Math.round(performance.now() - before)}ms: ${err}`,
        err,
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

    return pingPC(ip, port, env.PINGER_TIMEOUT);
  }

  /**
   * Pings a PE server and gets the response.
   *
   * @param server the server to ping
   * @returns the ping response or undefined if the server is offline
   */
  private async pingPEServer(): Promise<Ping | undefined> {
    return pingPE(this.ip, this.port || 19132, env.PINGER_TIMEOUT);
  }

  /**
   * Updates the cached ASN data.
   *
   * @param ipOrDomain the IP address or domain name to resolve
   */
  private async updateAsnData(ipOrDomain: string) {
    // Skip ASN update if we have data and IP hasn't changed
    if (this.asnData && this.previousPing?.ip === ipOrDomain) {
      return;
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
            `Failed to resolve domain ${ipOrDomain} to IP for ${this.getIdentifier()}, skipping ASN lookup`,
          );
          return;
        }
      } catch (err) {
        logger.warn(`Failed to resolve domain ${ipOrDomain} to IP for ${this.getIdentifier()}`, err);
        return;
      }
    }

    const asnData = MaxMindService.resolveAsn(ip);
    if (asnData) {
      // Log if ASN data has changed, ignore initial set
      if (this.asnData) {
        logger.info(`Updated ASN data for ${this.getIdentifier()}: ASN ${asnData.asn} (${asnData.asnOrg})`);
      }
      this.asnData = asnData;
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
