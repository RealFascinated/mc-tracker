use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TrendDirection {
    Growing,
    Stable,
    Declining,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryPoint {
    pub timestamp: i64,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeseriesSummaryResponse {
    pub from: i64,
    pub to: i64,
    pub series_key: String,
    pub start: Option<f64>,
    pub end: Option<f64>,
    pub avg: Option<f64>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub change_pct: Option<f64>,
    pub trend: TrendDirection,
    pub points: Vec<SummaryPoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerTimeseriesSummaryResponse {
    pub id: String,
    pub name: String,
    #[serde(flatten)]
    pub summary: TimeseriesSummaryResponse,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnTimeseriesSummaryResponse {
    pub asn: String,
    pub asn_org: String,
    #[serde(flatten)]
    pub summary: TimeseriesSummaryResponse,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum GrowthRankOrder {
    Gainers,
    Losers,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerGrowthRankItem {
    pub id: String,
    pub name: String,
    pub start: Option<f64>,
    pub end: Option<f64>,
    pub change_pct: Option<f64>,
    pub trend: TrendDirection,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServersGrowthRankResponse {
    pub from: i64,
    pub to: i64,
    pub order: GrowthRankOrder,
    pub servers: Vec<ServerGrowthRankItem>,
    pub errors: Vec<ServerGrowthRankError>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerGrowthRankError {
    pub id: String,
    pub error: String,
}
