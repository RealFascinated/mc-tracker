use serde::Serialize;

use super::error::PartialError;
use super::timeseries::TimeseriesLanes;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServersCompareTimeseriesItem {
    pub id: String,
    pub name: String,
    #[serde(flatten)]
    pub timeseries: TimeseriesLanes,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServersCompareTimeseriesResponse {
    pub from: i64,
    pub to: i64,
    pub servers: Vec<ServersCompareTimeseriesItem>,
    pub errors: Vec<PartialError>,
}
