use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeseriesQuery {
    pub from: i64,
    pub to: i64,
    #[serde(default)]
    pub daily_avg: bool,
    #[serde(default)]
    pub weekly_avg: bool,
}
