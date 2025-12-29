import { env } from "./common/env";
import ServerManager from "./server/server-manager";
import { MaxMindService } from "./service/maxmind-service";
import cron from "node-cron";

// Initialize the ASN database
await MaxMindService.init();

// Initialize the server manager
const serverManager = new ServerManager();

cron.schedule("0 2 * * *", async () => {
  await MaxMindService.scheduledUpdate();
});
cron.schedule(env.PINGER_SERVER_CRON, async () => {
  await serverManager.pingServers();
});