use std::sync::Arc;

use async_trait::async_trait;
use mc_api_types::{
    AsnTimeseriesSummaryResponse, ServerTimeseriesSummaryResponse, TimeseriesSummaryResponse,
};
use mc_insights::{
    AnalyzeOptions, DefaultTimeRangeParser, DefaultTimeseriesAnalyzer, InsightsError,
    ResolvedTimeRange, TimeRangeParser, TimeseriesAnalyzer,
};
use mc_metrics::MetricsError;
use uuid::Uuid;

use axum::http;

use crate::manager::ServerManager;

pub struct InsightsService {
    manager: Arc<ServerManager>,
    range_parser: Arc<dyn TimeRangeParser>,
    analyzer: Arc<dyn TimeseriesAnalyzer>,
}

impl InsightsService {
    pub fn new(
        manager: Arc<ServerManager>,
        range_parser: Arc<dyn TimeRangeParser>,
        analyzer: Arc<dyn TimeseriesAnalyzer>,
    ) -> Self {
        Self {
            manager,
            range_parser,
            analyzer,
        }
    }

    pub fn with_defaults(manager: Arc<ServerManager>) -> Self {
        Self::new(
            manager,
            Arc::new(DefaultTimeRangeParser),
            Arc::new(DefaultTimeseriesAnalyzer),
        )
    }

    pub async fn server_timeseries_summary(
        &self,
        id: Uuid,
        from: &str,
        to: &str,
    ) -> Result<ServerTimeseriesSummaryResponse, InsightsError> {
        let detail = self
            .manager
            .server_detail_response(id)
            .await
            .ok_or_else(|| InsightsError::InvalidRange("server not found".into()))?;
        let range = self.parse_range(from, to)?;
        let timeseries = self
            .manager
            .server_timeseries(id, range.from, range.to)
            .await
            .map_err(map_metrics_error)?;
        let summary = self.summarize(&timeseries.timeseries, range)?;
        Ok(ServerTimeseriesSummaryResponse {
            id: detail.id,
            name: detail.name,
            summary,
        })
    }

    pub async fn total_timeseries_summary(
        &self,
        from: &str,
        to: &str,
    ) -> Result<TimeseriesSummaryResponse, InsightsError> {
        let range = self.parse_range(from, to)?;
        let timeseries = self
            .manager
            .total_timeseries(range.from, range.to)
            .await
            .map_err(map_metrics_error)?;
        self.summarize(&timeseries.timeseries, range)
    }

    pub async fn asn_timeseries_summary(
        &self,
        asn: &str,
        asn_org: &str,
        from: &str,
        to: &str,
    ) -> Result<AsnTimeseriesSummaryResponse, InsightsError> {
        let range = self.parse_range(from, to)?;
        let timeseries = self
            .manager
            .asn_timeseries(asn, asn_org, range.from, range.to)
            .await
            .map_err(map_metrics_error)?;
        let summary = self.summarize(&timeseries.timeseries, range)?;
        Ok(AsnTimeseriesSummaryResponse {
            asn: timeseries.asn,
            asn_org: timeseries.asn_org,
            summary,
        })
    }

    fn parse_range(&self, from: &str, to: &str) -> Result<ResolvedTimeRange, InsightsError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        self.range_parser.parse(from, to, now)
    }

    fn summarize(
        &self,
        lanes: &mc_api_types::TimeseriesLanes,
        range: ResolvedTimeRange,
    ) -> Result<TimeseriesSummaryResponse, InsightsError> {
        self.analyzer.summarize(
            lanes,
            AnalyzeOptions {
                span_seconds: range.to - range.from,
                max_points: 30,
            },
        )
    }
}

#[async_trait]
impl mc_chat::InsightsRead for InsightsService {
    async fn server_timeseries_summary(
        &self,
        id: Uuid,
        from: &str,
        to: &str,
    ) -> Result<ServerTimeseriesSummaryResponse, InsightsError> {
        self.server_timeseries_summary(id, from, to).await
    }

    async fn total_timeseries_summary(
        &self,
        from: &str,
        to: &str,
    ) -> Result<TimeseriesSummaryResponse, InsightsError> {
        self.total_timeseries_summary(from, to).await
    }

    async fn asn_timeseries_summary(
        &self,
        asn: &str,
        asn_org: &str,
        from: &str,
        to: &str,
    ) -> Result<AsnTimeseriesSummaryResponse, InsightsError> {
        self.asn_timeseries_summary(asn, asn_org, from, to).await
    }
}

fn map_metrics_error(err: MetricsError) -> InsightsError {
    match err {
        MetricsError::InvalidWindow(message) => InsightsError::InvalidRange(message),
        other => InsightsError::InvalidRange(other.to_string()),
    }
}

pub fn map_insights_error(err: InsightsError) -> (http::StatusCode, String) {
    match err {
        InsightsError::InvalidRange(message) => (http::StatusCode::BAD_REQUEST, message),
        InsightsError::NoData => (http::StatusCode::NOT_FOUND, "no data in range".into()),
    }
}
