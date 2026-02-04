import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Environment
    ENVIRONMENT: z.string().default("development"),

    // Pinger
    PINGER_RETRY_ATTEMPTS: z.coerce.number(),
    PINGER_RETRY_DELAY: z.coerce.number(),
  },

  /**
   * This is the environment variables that are available on the server.
   */
  runtimeEnv: {
    // Environment
    ENVIRONMENT: process.env.ENVIRONMENT,

    // Pinger
    PINGER_RETRY_ATTEMPTS: process.env.PINGER_RETRY_ATTEMPTS,
    PINGER_RETRY_DELAY: process.env.PINGER_RETRY_DELAY,
  },

  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
