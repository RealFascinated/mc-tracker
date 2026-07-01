import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
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
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
