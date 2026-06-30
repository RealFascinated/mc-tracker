import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import tailwindcss from "@tailwindcss/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    ...(mode === "development" ? [devtools()] : []),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    host: true,
    port: 5173,
  },
}))
