import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const embedBuild = process.env.MC_TRACKER_EMBED_BUILD === "1";

export default defineConfig(({ mode }) => ({
  base: embedBuild ? "/ui/" : "/",
  resolve: { tsconfigPaths: true },
  plugins: [
    ...(mode === "development" ? [devtools()] : []),
    tailwindcss(),
    tanstackStart(
      embedBuild
        ? {
            spa: {
              enabled: true,
            },
          }
        : undefined,
    ),
    viteReact(),
  ],
  server: {
    host: true,
    port: 5173,
  },
}));
