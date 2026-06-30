use serde::Serialize;

use super::servers::PeakPlayersResponse;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnsListResponse {
    pub summary: AsnsSummaryResponse,
    pub asns: Vec<AsnListItemResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnsSummaryResponse {
    pub total_players: u64,
    pub players_pc: u64,
    pub players_pe: u64,
    pub tracked_asns: u32,
    pub tracked_servers: u32,
    pub last_updated: Option<i64>,
    pub peak_players24h: Option<f64>,
    pub peak_players30d: Option<f64>,
    pub peak_players_all_time: Option<PeakPlayersResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnListItemResponse {
    pub asn: String,
    pub asn_org: String,
    pub players_online: u32,
    pub server_count: u32,
    pub players_pc: u32,
    pub players_pe: u32,
    pub peak_players24h: Option<f64>,
    pub peak_players_all_time: Option<PeakPlayersResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnTimeseriesResponse {
    pub asn: String,
    pub asn_org: String,
    pub from: i64,
    pub to: i64,
    pub step: i64,
    pub timestamps: Vec<i64>,
    pub players_online: Vec<Option<f64>>,
}
