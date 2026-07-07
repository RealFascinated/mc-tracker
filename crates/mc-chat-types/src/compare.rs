use serde::Serialize;

use crate::error::ChatPartialError;
use crate::timeseries::ChatTimeseriesSnapshot;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatCompareServerItem {
    pub id: String,
    pub name: String,
    pub snapshot: ChatTimeseriesSnapshot,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatCompareServersResponse {
    pub from: i64,
    pub to: i64,
    pub servers: Vec<ChatCompareServerItem>,
    pub errors: Vec<ChatPartialError>,
}
