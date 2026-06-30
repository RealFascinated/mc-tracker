import { apiFetch } from "@/lib/api/client"

export type ServersSummary = {
  totalPlayers: number
  playersPc: number
  playersPe: number
  trackedServers: number
  lastUpdated: number | null
  peakPlayers24h: number | null
  peakPlayers30d: number | null
}

export type ServerListItem = {
  id: string
  name: string
  type: string
  host: string
  port: number | null
  asn: string
  asnOrg: string
  playersOnline: number | null
}

export type ServersListResponse = {
  summary: ServersSummary
  servers: ServerListItem[]
}

export type ServerTimeseriesResponse = {
  id: string
  from: number
  to: number
  step: number
  timestamps: number[]
  playersOnline: Array<number | null>
}

export function getServers() {
  return apiFetch<ServersListResponse>("/servers", { credentials: "omit" })
}

export function getServerTimeseries(
  id: string,
  from: number,
  to: number
) {
  const params = new URLSearchParams({
    from: String(from),
    to: String(to),
  })
  return apiFetch<ServerTimeseriesResponse>(
    `/servers/${id}/timeseries?${params}`,
    { credentials: "omit" }
  )
}
