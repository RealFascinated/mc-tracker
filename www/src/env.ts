import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { readClientEnv } from "@/lib/env-values";
import type { ClientEnv } from "@/lib/env-values";

const clientSchema = {
  VITE_MC_TRACKER_API_URL: z
    .string()
    .default("")
    .transform((url) => url.replace(/\/$/, "")),
  VITE_MC_TRACKER_UI_BASEPATH: z
    .string()
    .default("")
    .transform((value) => value.replace(/\/$/, "")),
  VITE_MC_TRACKER_SITE_URL: z
    .string()
    .default("")
    .transform((url) => url.replace(/\/$/, "")),
};

/**
 * Runtime validation is a dev convenience: in production the VITE_* values are
 * inlined at build time, so we read them directly and let the bundler drop the
 * zod/@t3-oss machinery from the shipped bundle.
 */
export const env: ClientEnv = import.meta.env.DEV
  ? createEnv({
      clientPrefix: "VITE_",
      client: clientSchema,
      runtimeEnv: import.meta.env,
      emptyStringAsUndefined: true,
    })
  : readClientEnv(import.meta.env);
