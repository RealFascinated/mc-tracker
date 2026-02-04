import { AsnLookup } from "mcutils-js-api/dist/types/server/server";
import { env } from "../common/env";
import { logger } from "../common/logger";
import type { ServerOptions, ServerType } from "../common/types/server";
import { Server as MinecraftServer } from "mcutils-js-api/dist/types/server/server";
import { JavaServer } from "mcutils-js-api/dist/types/server/impl/java-server";
import { BedrockServer } from "mcutils-js-api/dist/types/server/impl/bedrock-server";
import { mcUtils } from "..";

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
  public asnData?: AsnLookup;

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
   * Pings a server and gets the response.
   *
   * @returns the ping response or undefined if the server is offline
   */
  public async pingServer(
    attempt: number = 0,
  ): Promise<MinecraftServer | undefined> {
    const before = performance.now();
    try {
      let response: MinecraftServer | undefined;

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

      if (response == undefined) {
        if (attempt < env.PINGER_RETRY_ATTEMPTS) {
          logger.warn(
            `Failed to ping ${this.getIdentifier()} after ${Math.round(performance.now() - before)}ms, retrying... (attempt ${attempt + 1}/${env.PINGER_RETRY_ATTEMPTS})`,
          );

          await Bun.sleep(env.PINGER_RETRY_DELAY);
          return this.pingServer(attempt + 1);
        }

        return Promise.resolve(undefined);
      }
      this.asnData = response.asn ?? this.asnData;
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
  private async pingPCServer(): Promise<JavaServer | undefined> {
    const response = await mcUtils.fetchJavaServer(
      `${this.ip}:${this.port || 25565}`,
    );
    if (response.error || !response.server) {
      return undefined;
    }
    return response.server;
  }

  /**
   * Pings a PE server and gets the response.
   *
   * @param server the server to ping
   * @returns the ping response or undefined if the server is offline
   */
  private async pingPEServer(): Promise<BedrockServer | undefined> {
    const response = await mcUtils.fetchBedrockServer(
      `${this.ip}:${this.port || 19132}`,
    );
    if (response.error || !response.server) {
      return undefined;
    }
    return response.server;
  }
}
