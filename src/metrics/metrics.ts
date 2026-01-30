import { Registry, Gauge } from "prom-client";
import { logger } from "../common/logger";
import { env } from "../common/env";
import type { PingProvider } from "../common/types/server-ping";

export default class Metrics {
  private registry: Registry;
  private playerCountGauge: Gauge;
  private pingProvider: PingProvider | null = null;

  constructor() {
    logger.info("Initializing Prometheus metrics");

    this.registry = new Registry();
    this.registry.setDefaultLabels({
      environment: env.ENVIRONMENT,
    });

    this.playerCountGauge = new Gauge({
      name: "minecraft_server_player_count",
      help: "Number of players on Minecraft server",
      labelNames: ["id", "name", "type", "asn", "asn_org"],
      registers: [this.registry],
      collect: async () => {
        await this.collectPlayerCounts();
      },
    });

    logger.info("Prometheus metrics initialized");
  }

  public setPingProvider(fn: PingProvider): void {
    this.pingProvider = fn;
  }

  private async collectPlayerCounts(): Promise<void> {
    if (!this.pingProvider) {
      return;
    }

    this.playerCountGauge.reset();

    const results = await this.pingProvider();
    for (const { server, ping } of results) {
      this.playerCountGauge.set(
        {
          id: server.id,
          name: server.name,
          type: server.type,
          asn: server.asnData?.asn ?? "",
          asn_org: server.asnData?.asnOrg ?? "",
        },
        ping.playerCount,
      );
    }
  }

  public getRegistry(): Registry {
    return this.registry;
  }
}

export const metrics = new Metrics();
