import Elysia, { ValidationError } from "elysia";
import { cron } from "@elysiajs/cron";
import ServerManager from "./server/server-manager";
import { logger } from "./utils/logger";
import { decorators } from "elysia-decorators";
import AppController from "./controllers/app.controller";
import ServerController from "./controllers/server.controller";
import { MaxMindService } from "./utils/maxmind-service";
import { env } from "@mc-tracker/common/env";

// Initialize the ASN database
await MaxMindService.init();

// Initialize the server manager
const serverManager = new ServerManager();

export const app = new Elysia()
  // Schedule database updates daily at 2 AM
  .use(
    cron({
      name: "maxmind-update",
      pattern: "0 2 * * *", // Daily at 2 AM
      run: async () => {
        await MaxMindService.scheduledUpdate();
      },
    })
  )
  // Schedule server pings
  .use(
    cron({
      name: "server-ping",
      pattern: env.PINGER_SERVER_CRON,
      run: async () => {
        await serverManager.pingServers();
      },
    })
  );

/**
 * Custom error handler
 */
app.onError({ as: "global" }, ({ code, error }) => {
  // Return default error for type validation
  if (code === "VALIDATION") {
    return (error as ValidationError).all;
  }

  // Assume unknown error is an internal server error
  if (code === "UNKNOWN") {
    code = "INTERNAL_SERVER_ERROR";
  }

  let status: number | undefined = undefined;
  if (typeof error === "object" && error !== null && "status" in error) {
    status = (error as { status?: number }).status;
  }

  if (status === undefined) {
    switch (code) {
      case "INTERNAL_SERVER_ERROR":
        status = 500;
        break;
      case "NOT_FOUND":
        status = 404;
        break;
      case "PARSE":
        status = 400;
        break;
      case "INVALID_COOKIE_SIGNATURE":
        status = 401;
        break;
    }
  }

  if (code === 500) {
    console.log(error);
  }

  return {
    ...((status && { statusCode: status }) || { status: code }),
    // @ts-expect-error - message is not in the error type
    ...(error.message != code && { message: error.message }),
    timestamp: new Date().toISOString(),
  };
});

/**
 * Controllers
 */
app.use(
  decorators({
    controllers: [AppController, ServerController],
  })
);

app.onStart(async () => {
  logger.info("Done loading!");
});

app.listen(8080);
