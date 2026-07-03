use serde::Serialize;

use super::servers::{
    EntityPeakStats, PlayersPeakSummary, ServerListItemResponse, ServersSummaryResponse,
};
use super::timeseries::TimeseriesLanes;

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
    pub peaks: PlayersPeakSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnListItemResponse {
    pub asn: String,
    pub asn_org: String,
    pub players_online: u32,
    pub server_count: u32,
    pub peaks: EntityPeakStats,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnDetailResponse {
    pub asn: String,
    pub asn_org: String,
    pub players_online: u32,
    pub server_count: u32,
    pub peaks: EntityPeakStats,
    pub summary: ServersSummaryResponse,
    pub servers: Vec<ServerListItemResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnTimeseriesResponse {
    pub asn: String,
    pub asn_org: String,
    #[serde(flatten)]
    pub timeseries: TimeseriesLanes,
}
