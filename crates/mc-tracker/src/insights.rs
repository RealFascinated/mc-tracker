use std::sync::Arc;

use async_trait::async_trait;
use futures::future::join_all;
use mc_api_types::{
    AsnTimeseriesSummaryResponse, GrowthRankOrder, ServerGrowthRankError, ServerGrowthRankItem,
    ServerPeriodPeakRankItem, ServerTimeseriesSummaryResponse, ServersGrowthRankResponse,
    ServersPeriodPeakRankResponse, TimeseriesSummaryResponse,
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

    pub async fn rank_servers_by_growth(
        &self,
        from: &str,
        to: &str,
        limit: u32,
        order: GrowthRankOrder,
    ) -> Result<ServersGrowthRankResponse, InsightsError> {
        let range = self.parse_range(from, to)?;
        let limit = limit.clamp(1, 25) as usize;
        let list = self.manager.servers_list_response(None).await;
        let ids: Vec<Uuid> = list
            .servers
            .iter()
            .filter_map(|server| Uuid::parse_str(&server.id).ok())
            .collect();

        let futures: Vec<_> = ids
            .iter()
            .map(|&id| self.server_timeseries_summary(id, from, to))
            .collect();
        let results = join_all(futures).await;

        let mut ranked = Vec::with_capacity(results.len());
        let mut errors = Vec::new();
        for (id, result) in ids.into_iter().zip(results) {
            match result {
                Ok(summary) => ranked.push(ServerGrowthRankItem {
                    id: summary.id,
                    name: summary.name,
                    start: summary.summary.start,
                    end: summary.summary.end,
                    change_pct: summary.summary.change_pct,
                    trend: summary.summary.trend,
                }),
                Err(err) => errors.push(ServerGrowthRankError {
                    id: id.to_string(),
                    error: err.to_string(),
                }),
            }
        }

        ranked.sort_by(|left, right| compare_change_pct(left.change_pct, right.change_pct));
        if order == GrowthRankOrder::Gainers {
            ranked.reverse();
        }
        ranked.truncate(limit);

        Ok(ServersGrowthRankResponse {
            from: range.from,
            to: range.to,
            order,
            servers: ranked,
            errors,
        })
    }

    pub async fn rank_servers_by_period_peak(
        &self,
        from: &str,
        to: &str,
        limit: u32,
    ) -> Result<ServersPeriodPeakRankResponse, InsightsError> {
        let range = self.parse_range(from, to)?;
        let limit = limit.clamp(1, 25) as usize;
        let list = self.manager.servers_list_response(None).await;
        let ids: Vec<Uuid> = list
            .servers
            .iter()
            .filter_map(|server| Uuid::parse_str(&server.id).ok())
            .collect();

        let futures: Vec<_> = ids
            .iter()
            .map(|&id| self.server_timeseries_summary(id, from, to))
            .collect();
        let results = join_all(futures).await;

        let mut ranked = Vec::with_capacity(results.len());
        let mut errors = Vec::new();
        for (id, result) in ids.into_iter().zip(results) {
            match result {
                Ok(summary) => ranked.push(ServerPeriodPeakRankItem {
                    id: summary.id,
                    name: summary.name,
                    max: summary.summary.max,
                    avg: summary.summary.avg,
                }),
                Err(err) => errors.push(ServerGrowthRankError {
                    id: id.to_string(),
                    error: err.to_string(),
                }),
            }
        }

        ranked.sort_by(|left, right| compare_optional_f64(right.max, left.max));
        ranked.truncate(limit);

        Ok(ServersPeriodPeakRankResponse {
            from: range.from,
            to: range.to,
            servers: ranked,
            errors,
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

    async fn rank_servers_by_growth(
        &self,
        from: &str,
        to: &str,
        limit: u32,
        order: GrowthRankOrder,
    ) -> Result<ServersGrowthRankResponse, InsightsError> {
        self.rank_servers_by_growth(from, to, limit, order).await
    }

    async fn rank_servers_by_period_peak(
        &self,
        from: &str,
        to: &str,
        limit: u32,
    ) -> Result<ServersPeriodPeakRankResponse, InsightsError> {
        self.rank_servers_by_period_peak(from, to, limit).await
    }
}

fn compare_change_pct(
    left: Option<f64>,
    right: Option<f64>,
) -> std::cmp::Ordering {
    compare_optional_f64(left, right)
}

fn compare_optional_f64(left: Option<f64>, right: Option<f64>) -> std::cmp::Ordering {
    match (left, right) {
        (None, None) => std::cmp::Ordering::Equal,
        (None, Some(_)) => std::cmp::Ordering::Less,
        (Some(_), None) => std::cmp::Ordering::Greater,
        (Some(left), Some(right)) => left
            .partial_cmp(&right)
            .unwrap_or(std::cmp::Ordering::Equal),
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
