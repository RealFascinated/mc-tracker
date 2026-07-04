use std::sync::Arc;

use async_trait::async_trait;
use futures::future::join_all;
use mc_api_types::{
    AsnGrowthRankItem, AsnTimeseriesSummaryResponse, AsnsGrowthRankResponse, ErrorTarget,
    GrowthRankOrder, ServerGrowthRankItem, ServerPeriodPeakRankItem,
    ServerTimeseriesSummaryResponse, ServersCompareItem, ServersCompareResponse,
    ServersGrowthRankResponse, ServersPeriodPeakRankResponse, TimeseriesSummaryResponse,
};
use mc_common::constants::limits::DEFAULT_LIST_LIMIT;
use mc_common::constants::limits::MAX_COMPARE_SERVERS;
use mc_insights::{
    AnalyzeOptions, DefaultTimeRangeParser, DefaultTimeseriesAnalyzer, InsightsError,
    ResolvedTimeRange, TimeRangeParser, TimeseriesAnalyzer, DEFAULT_MAX_SUMMARY_POINTS,
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
        let summary = self.summarize(&timeseries.timeseries, range, DEFAULT_MAX_SUMMARY_POINTS)?;
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
        self.summarize(&timeseries.timeseries, range, DEFAULT_MAX_SUMMARY_POINTS)
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
        let summary = self.summarize(&timeseries.timeseries, range, DEFAULT_MAX_SUMMARY_POINTS)?;
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
        let limit = limit.clamp(1, DEFAULT_LIST_LIMIT) as usize;
        let list = self
            .manager
            .servers_list_response(
                None,
                mc_api_types::ServersListSortField::Players,
                mc_api_types::SortOrder::Desc,
            )
            .await;
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
                Err(err) => {
                    errors.push(err.to_partial_error(ErrorTarget::Server { id: id.to_string() }))
                }
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
        let limit = limit.clamp(1, DEFAULT_LIST_LIMIT) as usize;
        let list = self
            .manager
            .servers_list_response(
                None,
                mc_api_types::ServersListSortField::Players,
                mc_api_types::SortOrder::Desc,
            )
            .await;
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
                Err(err) => {
                    errors.push(err.to_partial_error(ErrorTarget::Server { id: id.to_string() }))
                }
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

    pub async fn rank_asns_by_growth(
        &self,
        from: &str,
        to: &str,
        limit: u32,
        order: GrowthRankOrder,
    ) -> Result<AsnsGrowthRankResponse, InsightsError> {
        let range = self.parse_range(from, to)?;
        let limit = limit.clamp(1, DEFAULT_LIST_LIMIT) as usize;
        let list = self.manager.asns_list_response(None).await;
        let keys: Vec<(String, String)> = list
            .asns
            .iter()
            .map(|asn| (asn.asn.clone(), asn.asn_org.clone()))
            .collect();

        let futures: Vec<_> = keys
            .iter()
            .map(|(asn, asn_org)| self.asn_timeseries_summary(asn, asn_org, from, to))
            .collect();
        let results = join_all(futures).await;

        let mut ranked = Vec::with_capacity(results.len());
        let mut errors = Vec::new();
        for ((asn, asn_org), result) in keys.into_iter().zip(results) {
            match result {
                Ok(summary) => ranked.push(AsnGrowthRankItem {
                    asn: summary.asn,
                    asn_org: summary.asn_org,
                    start: summary.summary.start,
                    end: summary.summary.end,
                    change_pct: summary.summary.change_pct,
                    trend: summary.summary.trend,
                }),
                Err(err) => errors.push(err.to_partial_error(ErrorTarget::Asn { asn, asn_org })),
            }
        }

        ranked.sort_by(|left, right| compare_change_pct(left.change_pct, right.change_pct));
        if order == GrowthRankOrder::Gainers {
            ranked.reverse();
        }
        ranked.truncate(limit);

        Ok(AsnsGrowthRankResponse {
            from: range.from,
            to: range.to,
            order,
            asns: ranked,
            errors,
        })
    }

    pub async fn compare_servers(
        &self,
        ids: &[Uuid],
        from: &str,
        to: &str,
        max_points: usize,
    ) -> Result<ServersCompareResponse, InsightsError> {
        if ids.len() < 2 || ids.len() > MAX_COMPARE_SERVERS {
            return Err(InsightsError::InvalidRange(format!(
                "need between 2 and {MAX_COMPARE_SERVERS} server ids"
            )));
        }
        let range = self.parse_range(from, to)?;
        if max_points == 0 {
            return Err(InsightsError::InvalidRange(
                "max_points must be at least 1".into(),
            ));
        }
        let max_points = max_points.min(mc_metrics::max_points() as usize);

        let futures: Vec<_> = ids
            .iter()
            .map(|&id| self.compare_server_item(id, range, max_points))
            .collect();
        let results = join_all(futures).await;

        let mut servers = Vec::with_capacity(results.len());
        let mut errors = Vec::new();
        for (&id, result) in ids.iter().zip(results) {
            match result {
                Ok(item) => servers.push(item),
                Err(err) => {
                    errors.push(err.to_partial_error(ErrorTarget::Server { id: id.to_string() }))
                }
            }
        }

        Ok(ServersCompareResponse {
            from: range.from,
            to: range.to,
            servers,
            errors,
        })
    }

    async fn compare_server_item(
        &self,
        id: Uuid,
        range: ResolvedTimeRange,
        max_points: usize,
    ) -> Result<ServersCompareItem, InsightsError> {
        let server = self
            .manager
            .server_detail_response(id)
            .await
            .ok_or_else(|| InsightsError::InvalidRange("server not found".into()))?;
        let timeseries = self
            .manager
            .server_timeseries(id, range.from, range.to)
            .await
            .map_err(map_metrics_error)?;
        let summary = self.summarize(&timeseries.timeseries, range, max_points)?;
        Ok(ServersCompareItem { server, summary })
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
        _range: ResolvedTimeRange,
        max_points: usize,
    ) -> Result<TimeseriesSummaryResponse, InsightsError> {
        self.analyzer
            .summarize(lanes, AnalyzeOptions { max_points })
    }
}

pub fn resolve_compare_max_points(requested: Option<usize>) -> Result<usize, InsightsError> {
    resolve_summary_max_points(requested, mc_metrics::max_points() as usize)
}

fn resolve_summary_max_points(
    requested: Option<usize>,
    default: usize,
) -> Result<usize, InsightsError> {
    let cap = mc_metrics::max_points() as usize;
    let points = requested.unwrap_or(default);
    if points == 0 {
        return Err(InsightsError::InvalidRange(
            "max_points must be at least 1".into(),
        ));
    }
    Ok(points.min(cap))
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

    async fn rank_asns_by_growth(
        &self,
        from: &str,
        to: &str,
        limit: u32,
        order: GrowthRankOrder,
    ) -> Result<AsnsGrowthRankResponse, InsightsError> {
        self.rank_asns_by_growth(from, to, limit, order).await
    }

    async fn compare_servers(
        &self,
        ids: &[Uuid],
        from: &str,
        to: &str,
        max_points: usize,
    ) -> Result<ServersCompareResponse, InsightsError> {
        self.compare_servers(ids, from, to, max_points).await
    }
}

fn compare_change_pct(left: Option<f64>, right: Option<f64>) -> std::cmp::Ordering {
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

pub fn map_insights_error(err: InsightsError) -> (http::StatusCode, mc_api_types::ApiError) {
    let status = match err.api_code() {
        mc_api_types::ApiErrorCode::ServerNotFound | mc_api_types::ApiErrorCode::NoData => {
            http::StatusCode::NOT_FOUND
        }
        mc_api_types::ApiErrorCode::InvalidRange => http::StatusCode::BAD_REQUEST,
        _ => http::StatusCode::INTERNAL_SERVER_ERROR,
    };
    (status, err.to_api_error())
}
