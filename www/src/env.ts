import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_MC_TRACKER_API_URL: z
      .url()
      .default("http://localhost:3000")
      .transform((url) => url.replace(/\/$/, "")),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
