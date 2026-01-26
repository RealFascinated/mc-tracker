import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Influx
    INFLUX_URL: z.string(),
    INFLUX_TOKEN: z.string(),
    INFLUX_DATABASE: z.string(),

    // Pinger
    PINGER_SERVER_CRON: z.string(),
    PINGER_DNS_INVALIDAION_CRON: z.string(),
    PINGER_TIMEOUT: z.number(),

    // MaxMind
    MAXMIND_LICENSE_KEY: z.string().optional(),
  },

  /**
   * This is the environment variables that are available on the server.
   */
  runtimeEnv: {
    // Influx
    INFLUX_URL: process.env.INFLUX_URL,
    INFLUX_TOKEN: process.env.INFLUX_TOKEN,
    INFLUX_DATABASE: process.env.INFLUX_DATABASE,

    // Pinger
    PINGER_SERVER_CRON: process.env.PINGER_SERVER_CRON,
    PINGER_DNS_INVALIDAION_CRON: process.env.PINGER_DNS_INVALIDAION_CRON,
    PINGER_TIMEOUT: process.env.PINGER_TIMEOUT,

    // MaxMind
    MAXMIND_LICENSE_KEY: process.env.MAXMIND_LICENSE_KEY,
  },

  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,

  /**
   * Whether to skip validation of the environment variables.
   */
  skipValidation: true,
});
