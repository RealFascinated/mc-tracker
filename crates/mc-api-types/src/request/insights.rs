use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServersCompareQuery {
    pub ids: String,
    pub from: i64,
    pub to: i64,
}
