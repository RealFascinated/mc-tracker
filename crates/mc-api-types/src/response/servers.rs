use serde::Serialize;

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
    pub last_updated: Option<i64>,
    pub peak_players24h: Option<f64>,
    pub peak_players30d: Option<f64>,
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
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerTimeseriesResponse {
    pub id: String,
    pub from: i64,
    pub to: i64,
    pub step: i64,
    pub timestamps: Vec<i64>,
    pub players_online: Vec<Option<f64>>,
}
