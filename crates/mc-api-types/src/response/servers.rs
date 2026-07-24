use serde::Serialize;

use super::monitored_server_events::MonitoredServerEventResponse;
use super::timeseries::TimeseriesLanes;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeakPlayersRecord {
    pub players: u32,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayersPeakSummary {
    pub players_24h: Option<f64>,
    pub players_7d: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityPeakStats {
    pub players_24h: Option<f64>,
    pub all_time: Option<PeakPlayersRecord>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServersListResponse {
    pub summary: ServersSummaryResponse,
    pub servers: Vec<ServerListItemResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServersSummaryResponse {
    pub total_players: u64,
    pub players_pc: u64,
    pub players_pe: u64,
    pub tracked_servers: u32,
    pub peaks: PlayersPeakSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerListItemResponse {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub server_type: String,
    pub host: String,
    pub port: Option<i32>,
    pub asn: String,
    pub asn_org: String,
    pub players_online: Option<u32>,
    pub favicon: Option<String>,
    pub peaks: EntityPeakStats,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServersSearchResponse {
    pub servers: Vec<ServerSearchItemResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSearchItemResponse {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub server_type: String,
    pub host: String,
    pub port: Option<i32>,
    pub favicon: Option<String>,
    pub players_online: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerTimeseriesResponse {
    pub id: String,
    #[serde(flatten)]
    pub timeseries: TimeseriesLanes,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub events: Vec<MonitoredServerEventResponse>,
}
