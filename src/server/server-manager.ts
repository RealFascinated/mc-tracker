import { logger } from "../common/logger";
import Server, { ServerType } from "./server";
import { validate as uuidValidate } from "uuid";

import Servers from "../../data/servers.json";
import { influx } from "../influx/influx";
import { Point } from "@influxdata/influxdb-client";

export default class ServerManager {
  public static SERVERS: Server[] = [];

  constructor() {
    logger.info("Loading servers...");
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
   * Ping all servers to update their status.
   */
  public async pingServers(): Promise<void> {
    logger.info(`Pinging servers ${ServerManager.SERVERS.length}`);

    const playerCountByAsn: Record<string, number> = {};
    const asns: Record<string, { asn: string; asnOrg: string }> = {};

    let globalPlayerCount = 0;
    let successfulPings = 0;

    await Promise.all(
      ServerManager.SERVERS.map(async (server) => {
        const previousAsnId = server.asnData?.asn;

        const ping = await server.pingServer();
        if (ping) {
          successfulPings++;
          globalPlayerCount += ping.playerCount;
        }

        const playerCount = ping?.playerCount ?? 0;

        if (
          server.asnData &&
          server.asnData.asn &&
          server.asnData.asn.trim() !== "" &&
          server.asnData.asnOrg &&
          server.asnData.asnOrg.trim() !== ""
        ) {
          const asn = server.asnData.asn;
          const asnPlayerCount = (playerCountByAsn[asn] ?? 0) + playerCount;
          playerCountByAsn[asn] = asnPlayerCount;
          asns[asn] = {
            asn: server.asnData.asn,
            asnOrg: server.asnData.asnOrg,
          };

          if (previousAsnId !== undefined && previousAsnId !== asn) {
            logger.info(
              `Server ${server.name} switched asn from ${previousAsnId} to ${asn}`,
            );
          }
        }
      }),
    );

    for (const [asn, playerCount] of Object.entries(playerCountByAsn)) {
      const asnData = asns[asn];
      if (!asnData) {
        logger.warn(`Missing ASN data for asn "${asn}", skipping write`);
        continue;
      }

      try {
        influx.writePoint(
          new Point("playerCountByAsn")
            .tag("asn", asnData.asn)
            .tag("asnOrg", asnData.asnOrg)
            .intField("playerCount", playerCount)
            .timestamp(Date.now()),
        );
      } catch (err) {
        logger.warn(`Failed to write point to Influx for ${asnData.asn}`, err);
      }
    }

    try {
      if (successfulPings > 0) {
        influx.writePoint(
          new Point("globalPlayerCount")
            .intField("playerCount", globalPlayerCount)
            .timestamp(Date.now()),
        );
      }
    } catch (err) {
      logger.warn(
        `Failed to write point to Influx for Global player count`,
        err,
      );
    }

    logger.info(
      `Finished pinging servers! ${successfulPings}/${ServerManager.SERVERS.length} servers responded to ping!`,
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
