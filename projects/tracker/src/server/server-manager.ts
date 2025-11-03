import cron from "node-cron";
import { logger } from "../utils/logger";
import Server, { ServerType } from "./server";
import { env } from "@mc-tracker/common/env";
import { validate as uuidValidate } from "uuid";

import Servers from "../../../../data/servers.json";
import { AsnData } from "mcutils-js-api/dist/types/server/server";
import { influx } from "../influx/influx";
import { Point } from "@influxdata/influxdb-client";

export default class ServerManager {
  public static SERVERS: Server[] = [];

  constructor() {
    logger.info("Loading servers...");
    for (const configServer of Servers.sort((a, b) =>
      a.type.localeCompare(b.type)
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
        `Loaded ${configServer.type} server ${configServer.name} - ${configServer.ip} (${configServer.id})`
      );
    }

    // Validate all server ids are unique
    const serverIds = ServerManager.SERVERS.map((server) => server.id);
    if (new Set(serverIds).size !== serverIds.length) {
      throw new Error(`Duplicate server ids found`);
    }

    logger.info(`Loaded ${ServerManager.SERVERS.length} servers!`);

    cron.schedule(env.PINGER_SERVER_CRON, async () => {
      await this.pingServers();
    });
  }

  /**
   * Ping all servers to update their status.
   */
  private async pingServers(): Promise<void> {
    logger.info(`Pinging servers ${ServerManager.SERVERS.length}`);

    const playerCountByAsn: Record<string, number> = {};
    const asns: Record<string, AsnData> = {};

    let globalPlayerCount = 0;

    await Promise.all(
      ServerManager.SERVERS.map(async (server) => {
        const ping = await server.pingServer();
        if (ping) {
          globalPlayerCount += ping.playerCount;

          if (server.asnData) {
            const playerCount =
              (playerCountByAsn[server.asnData.asn] ?? 0) + ping.playerCount;
            playerCountByAsn[server.asnData.asn] = playerCount;
            asns[server.asnData.asn] = server.asnData;
          }
        }
      })
    );

    for (const [asn, playerCount] of Object.entries(playerCountByAsn)) {
      const asnData = asns[asn];
      try {
        influx.writePoint(
          new Point("playerCountByAsn")
            .tag("asn", asnData.asn)
            .tag("asnOrg", asnData.asnOrg)
            .intField("playerCount", playerCount)
            .timestamp(Date.now())
        );
      } catch (err) {
        logger.warn(`Failed to write point to Influx for ${asnData.asn}`, err);
      }
    }

    try {
      influx.writePoint(
        new Point("globalPlayerCount")
          .intField("playerCount", globalPlayerCount)
          .timestamp(Date.now())
      );
      console.log("wrote globalPlayerCount");
    } catch (err) {
      logger.warn(
        `Failed to write point to Influx for Global player count`,
        err
      );
    }

    logger.info("Finished pinging servers!");
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
