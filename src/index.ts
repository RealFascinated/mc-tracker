import ServerManager from "./server/server-manager";
import { MaxMindService } from "./service/maxmind-service";
import { metrics } from "./metrics/metrics";
import cron from "node-cron";

// Initialize the ASN database
await MaxMindService.init();

// Initialize the server manager
const serverManager = new ServerManager();
metrics.setPingProvider(() => serverManager.getServerPings());

// Start HTTP server for metrics endpoint
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/metrics") {
      const metricsText = await metrics.getRegistry().metrics();
      return new Response(metricsText, {
        headers: {
          "Content-Type": "text/plain; version=0.0.4",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(
  `Metrics server running on http://localhost:${server.port}/metrics`,
);

cron.schedule("0 2 * * *", async () => {
  await MaxMindService.scheduledUpdate();
});
