import { env } from "@/env";

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = env.VITE_MC_TRACKER_API_URL;
  return base ? `${base}${normalized}` : normalized;
}
