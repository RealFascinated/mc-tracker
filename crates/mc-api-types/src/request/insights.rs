use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeseriesSummaryQuery {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServersCompareQuery {
    pub ids: String,
    pub from: String,
    pub to: String,
    pub max_points: Option<usize>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnTimeseriesSummaryQuery {
    pub from: String,
    pub to: String,
    pub asn: String,
    #[serde(default)]
    pub asn_org: Option<String>,
}
