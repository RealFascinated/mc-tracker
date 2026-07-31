/**
 * Dependency-free reader for client env values.
 *
 * Production builds inline `import.meta.env.VITE_*` at build time, so runtime
 * validation (zod + @t3-oss/env-core) is a dev-only convenience. This module
 * replicates the shape and transforms of `env.ts` without pulling the
 * validation machinery into the client bundle.
 */
export type ClientEnv = {
  VITE_MC_TRACKER_API_URL: string;
  VITE_MC_TRACKER_UI_BASEPATH: string;
  VITE_MC_TRACKER_SITE_URL: string;
};

// Mirrors `emptyStringAsUndefined` + `.default("")` from the zod schema.
const stringOrEmpty = (value: unknown) =>
  typeof value === "string" ? value : "";

// Mirrors the zod `.transform()` on each VITE_ var.
const stripTrailingSlash = (value: string) => value.replace(/\/$/, "");

export function readClientEnv(meta: Record<string, unknown>): ClientEnv {
  return {
    VITE_MC_TRACKER_API_URL: stripTrailingSlash(
      stringOrEmpty(meta.VITE_MC_TRACKER_API_URL),
    ),
    VITE_MC_TRACKER_UI_BASEPATH: stripTrailingSlash(
      stringOrEmpty(meta.VITE_MC_TRACKER_UI_BASEPATH),
    ),
    VITE_MC_TRACKER_SITE_URL: stripTrailingSlash(
      stringOrEmpty(meta.VITE_MC_TRACKER_SITE_URL),
    ),
  };
}
