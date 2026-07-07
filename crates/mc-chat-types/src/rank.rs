use serde::Serialize;

use crate::error::ChatPartialError;
use crate::timeseries::ChatTrend;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ChatGrowthRankOrder {
    Gainers,
    Losers,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatServerGrowthRankItem {
    pub id: String,
    pub name: String,
    pub start: Option<f64>,
    pub end: Option<f64>,
    pub change_pct: Option<f64>,
    pub trend: ChatTrend,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatServersGrowthRankResponse {
    pub from: i64,
    pub to: i64,
    pub order: ChatGrowthRankOrder,
    pub servers: Vec<ChatServerGrowthRankItem>,
    pub errors: Vec<ChatPartialError>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatServerPeriodPeakRankItem {
    pub id: String,
    pub name: String,
    pub max: Option<f64>,
    pub avg: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatServersPeriodPeakRankResponse {
    pub from: i64,
    pub to: i64,
    pub servers: Vec<ChatServerPeriodPeakRankItem>,
    pub errors: Vec<ChatPartialError>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatAsnGrowthRankItem {
    pub asn: String,
    pub asn_org: String,
    pub start: Option<f64>,
    pub end: Option<f64>,
    pub change_pct: Option<f64>,
    pub trend: ChatTrend,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatAsnsGrowthRankResponse {
    pub from: i64,
    pub to: i64,
    pub order: ChatGrowthRankOrder,
    pub asns: Vec<ChatAsnGrowthRankItem>,
    pub errors: Vec<ChatPartialError>,
}
