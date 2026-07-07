use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ChatTrend {
    Growing,
    Stable,
    Declining,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatPoint {
    pub timestamp: i64,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatTimeseriesSnapshot {
    pub from: i64,
    pub to: i64,
    pub series_key: String,
    pub start: Option<f64>,
    pub end: Option<f64>,
    pub avg: Option<f64>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub change_pct: Option<f64>,
    pub trend: ChatTrend,
    pub points: Vec<ChatPoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatServerTimeseriesSnapshot {
    pub id: String,
    pub name: String,
    #[serde(flatten)]
    pub snapshot: ChatTimeseriesSnapshot,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatAsnTimeseriesSnapshot {
    pub asn: String,
    pub asn_org: String,
    #[serde(flatten)]
    pub snapshot: ChatTimeseriesSnapshot,
}
