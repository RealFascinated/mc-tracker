import { Registry, Gauge } from "prom-client";
import { logger } from "../common/logger";
import { env } from "../common/env";

function labelsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keys = ["id", "name", "type", "asn", "asn_org", "environment"];
  return keys.every((key) => a[key] === b[key]);
}

export default class Metrics {
  private registry: Registry;
  private playerCountGauge: Gauge;
  private lastLabelsByServerId: Map<string, Record<string, string>> = new Map();

  constructor() {
    logger.info("Initializing Prometheus metrics");

    this.registry = new Registry();

    // Create Gauge metric for player count
    this.playerCountGauge = new Gauge({
      name: "minecraft_server_player_count",
      help: "Number of players on Minecraft server",
      labelNames: ["id", "name", "type", "asn", "asn_org", "environment"],
      registers: [this.registry],
    });

    logger.info("Prometheus metrics initialized");
  }

  /**
   * Write a metric for a server's player count.
   *
   * @param id server id
   * @param name server name
   * @param type server type (PC or PE)
   * @param playerCount number of players
   * @param asn optional ASN number
   * @param asnOrg optional ASN organization
   */
  public writeMetric(
    id: string,
    name: string,
    type: string,
    playerCount: number,
    asn?: string,
    asnOrg?: string,
  ): void {
    const labels: Record<string, string> = {
      id,
      name,
      type,
      asn: asn || "",
      asn_org: asnOrg || "",
      environment: env.ENVIRONMENT,
    };

    const previousLabels = this.lastLabelsByServerId.get(id);
    if (previousLabels && !labelsEqual(previousLabels, labels)) {
      this.playerCountGauge.remove(previousLabels);
    }
    this.playerCountGauge.set(labels, playerCount);
    this.lastLabelsByServerId.set(id, labels);
  }

  /**
   * Get the metrics registry.
   */
  public getRegistry(): Registry {
    return this.registry;
  }
}

/**
 * The metrics instance.
 */
export const metrics = new Metrics();
