import cron from "node-cron";
import { logger } from "../utils/logger";

import Config from "../../data/config.json";
import Websites from "../../data/websites.json";
import Website from "./website";

export default class WebsiteManager {
  private websites: Website[] = [];

  constructor() {
    logger.info("Loading websites...");
    for (const configWebsite of Websites) {
      const website = new Website({
        name: configWebsite.name,
        url: configWebsite.url,
      });
      this.websites.push(website);
    }
    logger.info(`Loaded ${this.websites.length} websites!`);

    cron.schedule(Config.pinger.pingCron, async () => {
      await this.pingWebsites();
    });
  }

  /**
   * Ping all websites to update their status.
   */
  private async pingWebsites(): Promise<void> {
    logger.info(`Pinging websites ${this.websites.length}`);

    // ping all websites in parallel
    await Promise.all(this.websites.map((website) => website.pingWebsite()));

    logger.info("Finished pinging websites!");
  }
}
