use std::collections::BTreeMap;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeseriesLane {
    pub step: i64,
    pub timestamps: Vec<i64>,
    pub values: Vec<Option<f64>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeseriesLanes {
    pub from: i64,
    pub to: i64,
    pub series: BTreeMap<String, TimeseriesLane>,
}

impl TimeseriesLanes {
    pub fn new(from: i64, to: i64) -> Self {
        Self {
            from,
            to,
            series: BTreeMap::new(),
        }
    }

    pub fn insert_lane(
        &mut self,
        key: &str,
        step: i64,
        timestamps: Vec<i64>,
        values: Vec<Option<f64>>,
    ) {
        self.series.insert(
            key.to_string(),
            TimeseriesLane {
                step,
                timestamps,
                values,
            },
        );
    }
}

pub mod keys {
    pub const PLAYERS_ONLINE: &str = "playersOnline";
    pub const PLAYERS_JAVA: &str = "playersJava";
    pub const PLAYERS_BEDROCK: &str = "playersBedrock";
}
