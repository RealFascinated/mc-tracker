use serde::Deserialize;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnsListQuery {
    #[serde(default)]
    pub search: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnTimeseriesQuery {
    pub from: i64,
    pub to: i64,
    pub asn: String,
    #[serde(default)]
    pub asn_org: Option<String>,
}
