use mc_api_types::TimeseriesSummaryResponse;

use crate::constants::DEFAULT_MAX_SUMMARY_POINTS;
use crate::error::InsightsError;

pub trait TimeRangeParser: Send + Sync {
    fn parse(&self, from: &str, to: &str, now: i64) -> Result<ResolvedTimeRange, InsightsError>;
}

pub trait TimeseriesAnalyzer: Send + Sync {
    fn summarize(
        &self,
        lanes: &mc_api_types::TimeseriesLanes,
        options: AnalyzeOptions,
    ) -> Result<TimeseriesSummaryResponse, InsightsError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResolvedTimeRange {
    pub from: i64,
    pub to: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct AnalyzeOptions {
    pub span_seconds: i64,
    pub max_points: usize,
}

impl Default for AnalyzeOptions {
    fn default() -> Self {
        Self {
            span_seconds: 0,
            max_points: DEFAULT_MAX_SUMMARY_POINTS,
        }
    }
}
