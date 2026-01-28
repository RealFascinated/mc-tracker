import { logger } from "../common/logger";
import Server, { ServerType } from "./server";
import { validate as uuidValidate } from "uuid";
import { join } from "path";
import { readFileSync } from "fs";
import { Point } from "@influxdata/influxdb3-client";
import { influx } from "../influx/influx";

interface ServerConfig {
  name: string;
  id: string;
  ip: string;
  type: "PC" | "PE";
}

export default class ServerManager {
  public static SERVERS: Server[] = [];

  constructor() {
    logger.info("Loading servers...");
    const Servers = ServerManager.loadServers();

    for (const configServer of Servers.sort((a, b) =>
      a.type.localeCompare(b.type),
    )) {
      // Validate server id is a valid uuid
      if (!uuidValidate(configServer.id)) {
        throw new Error(`Invalid server id: ${configServer.id}`);
      }

      // Validate server type is valid
      if (!["PC", "PE"].includes(configServer.type)) {
        throw new Error(`Invalid server type: ${configServer.type}`);
      }

      const server = new Server({
        id: configServer.id,
        ip: configServer.ip,
        name: configServer.name,
        type: configServer.type as ServerType,
      });
      ServerManager.SERVERS.push(server);
      logger.info(
        `Loaded ${configServer.type} server ${configServer.name} - ${configServer.ip} (${configServer.id})`,
      );
    }

    // Validate all server ids are unique
    const serverIds = ServerManager.SERVERS.map((server) => server.id);
    if (new Set(serverIds).size !== serverIds.length) {
      throw new Error(`Duplicate server ids found`);
    }

    logger.info(`Loaded ${ServerManager.SERVERS.length} servers!`);
  }

  /**
   * Load the servers from the servers.json file.
   *
   * @returns the servers
   */
  private static loadServers(): ServerConfig[] {
    const serversPath = join(process.cwd(), "data", "servers.json");

    try {
      const fileContent = readFileSync(serversPath, "utf-8");
      return JSON.parse(fileContent) as ServerConfig[];
    } catch (error) {
      throw new Error(
        `Failed to load servers.json from ${serversPath}: ${error}`,
      );
    }
  }

  /**
   * Ping all servers to update their status.
   */
  public async pingServers(): Promise<void> {
    const date = new Date();
    logger.info(`Pinging servers ${ServerManager.SERVERS.length}`);

    let successfulPings = 0;
    const pings = await Promise.all(
      ServerManager.SERVERS.map(async (server) => {
        try {
          const ping = await server.pingServer();
          if (ping) {
            successfulPings++;
            return {
              server: server,
              ping: ping,
            };
          }
        } catch (err) {} // Ignore the error, continue fetching servers
      }),
    );

    let successfulWrites = 0;
    for (const { server, ping } of pings.filter((ping) => ping !== undefined)) {
      try {
        const point = Point.measurement("ping")
          .setTag("id", server.id)
          .setTag("name", server.name)
          .setTag("type", server.type)
          .setIntegerField("player_count", ping.playerCount)
          .setTimestamp(date);

        if (server.asnData?.asn && server.asnData?.asnOrg) {
          point.setTag("asn", server.asnData.asn);
          point.setTag("asn_org", server.asnData.asnOrg);
        }

        influx.writePoint(point);
        successfulWrites++;
      } catch (err) {
        logger.warn(
          `Failed to write point to Influx for ${server.name} - ${server.ip}`,
          err,
        );
      }
    }

    logger.info(
      `Finished pinging servers! ${successfulPings}/${ServerManager.SERVERS.length} servers responded to ping! ${successfulWrites}/${pings.length} points written to Influx!`,
    );
  }

  /**
   * Get a server by its id.
   *
   * @param id the id of the server
   * @returns the server or undefined if not found
   */
  public static getServerById(id: string): Server | undefined {
    for (const server of ServerManager.SERVERS) {
      if (server.id === id) {
        return server;
      }
    }

    return undefined;
  }
}
