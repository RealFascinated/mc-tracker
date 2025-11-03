import Elysia, { ValidationError } from "elysia";
import ServerManager from "./server/server-manager";
import { logger } from "./utils/logger";
import { decorators } from "elysia-decorators";
import AppController from "./controllers/app.controller";
import ServerController from "./controllers/server.controller";

// Initialize the server manager
new ServerManager();

export const app = new Elysia();

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
