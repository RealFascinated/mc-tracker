import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Environment
    ENVIRONMENT: z.string().default("development"),

    // Pinger
    PINGER_DNS_INVALIDAION_CRON: z.string(),
    PINGER_TIMEOUT: z.coerce.number(),
    PINGER_RETRY_ATTEMPTS: z.coerce.number(),
    PINGER_RETRY_DELAY: z.coerce.number(),

    // MaxMind
    MAXMIND_LICENSE_KEY: z.string().optional(),
  },

  /**
   * This is the environment variables that are available on the server.
   */
  runtimeEnv: {
    // Environment
    ENVIRONMENT: process.env.ENVIRONMENT,

    // Pinger
    PINGER_DNS_INVALIDAION_CRON: process.env.PINGER_DNS_INVALIDAION_CRON,
    PINGER_TIMEOUT: process.env.PINGER_TIMEOUT,
    PINGER_RETRY_ATTEMPTS: process.env.PINGER_RETRY_ATTEMPTS,
    PINGER_RETRY_DELAY: process.env.PINGER_RETRY_DELAY,

    // MaxMind
    MAXMIND_LICENSE_KEY: process.env.MAXMIND_LICENSE_KEY,
  },

  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
