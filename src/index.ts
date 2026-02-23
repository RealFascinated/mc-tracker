import McUtilsAPI from "mcutils-js-api";
import { metrics } from "./metrics/metrics";
import ServerManager from "./server/server-manager";

export const mcUtils = new McUtilsAPI();

// Initialize the server manager
const serverManager = new ServerManager();
metrics.setPingProvider(() => serverManager.getServerPings());

// Start HTTP server for metrics endpoint
const server = Bun.serve({
  port: 3000,
  idleTimeout: 255,
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
