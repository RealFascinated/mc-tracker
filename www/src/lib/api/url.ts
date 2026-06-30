import { env } from "@/env"

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${env.VITE_MC_TRACKER_API_URL}${normalized}`
}
