use std::sync::Arc;

use futures::future::join_all;
use mc_chat_types::{
    ChatAsnGrowthRankItem, ChatAsnTimeseriesSnapshot, ChatAsnsGrowthRankResponse,
    ChatCompareServerItem, ChatCompareServersResponse, ChatErrorTarget, ChatGrowthRankOrder,
    ChatServerGrowthRankItem, ChatServerPeriodPeakRankItem, ChatServerTimeseriesSnapshot,
    ChatServersGrowthRankResponse, ChatServersPeriodPeakRankResponse, ChatTimeseriesSnapshot,
};
use mc_common::constants::limits::{DEFAULT_LIST_LIMIT, MAX_COMPARE_SERVERS};
use uuid::Uuid;

use crate::catalog::ServerCatalog;
use crate::core::{
    fetch_asn_snapshot, fetch_server_snapshot, fetch_total_snapshot, parse_insights_range,
    DEFAULT_MAX_SNAPSHOT_POINTS,
};
use crate::error::InsightsError;
use crate::Insights;

const SERIES_KEY: &str = mc_api_types::timeseries_keys::PLAYERS_ONLINE;

pub struct InsightsChat {
    insights: Arc<Insights>,
    catalog: Arc<dyn ServerCatalog>,
}

impl InsightsChat {
    pub fn new(insights: Arc<Insights>, catalog: Arc<dyn ServerCatalog>) -> Self {
        Self { insights, catalog }
    }

    pub async fn server_timeseries_summary(
        &self,
        id: Uuid,
        from: &str,
        to: &str,
    ) -> Result<ChatServerTimeseriesSnapshot, InsightsError> {
        let detail = self
            .catalog
            .server_detail(id)
            .await
            .ok_or_else(|| InsightsError::InvalidRange("server not found".into()))?;
        let range = self.parse_range(from, to)?;
        let snapshot = fetch_server_snapshot(
            &self.insights,
            self.catalog.as_ref(),
            id,
            range.from,
            range.to,
            SERIES_KEY,
            DEFAULT_MAX_SNAPSHOT_POINTS,
        )
        .await?;
        Ok(ChatServerTimeseriesSnapshot {
            id: detail.id.to_string(),
            name: detail.name,
            snapshot,
        })
    }

    pub async fn total_timeseries_summary(
        &self,
        from: &str,
        to: &str,
    ) -> Result<ChatTimeseriesSnapshot, InsightsError> {
        let range = self.parse_range(from, to)?;
        fetch_total_snapshot(
            &self.insights,
            self.catalog.as_ref(),
            range.from,
            range.to,
            SERIES_KEY,
            DEFAULT_MAX_SNAPSHOT_POINTS,
        )
        .await
    }

    pub async fn asn_timeseries_summary(
        &self,
        asn: &str,
        asn_org: &str,
        from: &str,
        to: &str,
    ) -> Result<ChatAsnTimeseriesSnapshot, InsightsError> {
        let range = self.parse_range(from, to)?;
        let snapshot = fetch_asn_snapshot(
            &self.insights,
            self.catalog.as_ref(),
            asn,
            asn_org,
            range.from,
            range.to,
            SERIES_KEY,
            DEFAULT_MAX_SNAPSHOT_POINTS,
        )
        .await?;
        Ok(ChatAsnTimeseriesSnapshot {
            asn: asn.to_string(),
            asn_org: asn_org.to_string(),
            snapshot,
        })
    }

    pub async fn rank_servers_by_growth(
        &self,
        from: &str,
        to: &str,
        limit: u32,
        order: ChatGrowthRankOrder,
    ) -> Result<ChatServersGrowthRankResponse, InsightsError> {
        let range = self.parse_range(from, to)?;
        let limit = limit.clamp(1, DEFAULT_LIST_LIMIT) as usize;
        let ids = self.catalog.list_server_ids().await;

        let futures: Vec<_> = ids
            .iter()
            .map(|&id| self.server_timeseries_summary(id, from, to))
            .collect();
        let results = join_all(futures).await;

        let mut ranked = Vec::with_capacity(results.len());
        let mut errors = Vec::new();
        for (id, result) in ids.into_iter().zip(results) {
            match result {
                Ok(summary) => ranked.push(ChatServerGrowthRankItem {
                    id: summary.id,
                    name: summary.name,
                    start: summary.snapshot.start,
                    end: summary.snapshot.end,
                    change_pct: summary.snapshot.change_pct,
                    trend: summary.snapshot.trend,
                }),
                Err(err) => errors
                    .push(err.to_partial_error(ChatErrorTarget::Server { id: id.to_string() })),
            }
        }

        ranked.sort_by(|left, right| compare_change_pct(left.change_pct, right.change_pct));
        if order == ChatGrowthRankOrder::Gainers {
            ranked.reverse();
        }
        ranked.truncate(limit);

        Ok(ChatServersGrowthRankResponse {
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
    ) -> Result<ChatServersPeriodPeakRankResponse, InsightsError> {
        let range = self.parse_range(from, to)?;
        let limit = limit.clamp(1, DEFAULT_LIST_LIMIT) as usize;
        let ids = self.catalog.list_server_ids().await;

        let futures: Vec<_> = ids
            .iter()
            .map(|&id| self.server_timeseries_summary(id, from, to))
            .collect();
        let results = join_all(futures).await;

        let mut ranked = Vec::with_capacity(results.len());
        let mut errors = Vec::new();
        for (id, result) in ids.into_iter().zip(results) {
            match result {
                Ok(summary) => ranked.push(ChatServerPeriodPeakRankItem {
                    id: summary.id,
                    name: summary.name,
                    max: summary.snapshot.max,
                    avg: summary.snapshot.avg,
                }),
                Err(err) => errors
                    .push(err.to_partial_error(ChatErrorTarget::Server { id: id.to_string() })),
            }
        }

        ranked.sort_by(|left, right| compare_optional_f64(right.max, left.max));
        ranked.truncate(limit);

        Ok(ChatServersPeriodPeakRankResponse {
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
        order: ChatGrowthRankOrder,
    ) -> Result<ChatAsnsGrowthRankResponse, InsightsError> {
        let range = self.parse_range(from, to)?;
        let limit = limit.clamp(1, DEFAULT_LIST_LIMIT) as usize;
        let keys = self.catalog.list_asn_keys().await;

        let futures: Vec<_> = keys
            .iter()
            .map(|(asn, asn_org)| self.asn_timeseries_summary(asn, asn_org, from, to))
            .collect();
        let results = join_all(futures).await;

        let mut ranked = Vec::with_capacity(results.len());
        let mut errors = Vec::new();
        for ((asn, asn_org), result) in keys.into_iter().zip(results) {
            match result {
                Ok(summary) => ranked.push(ChatAsnGrowthRankItem {
                    asn: summary.asn,
                    asn_org: summary.asn_org,
                    start: summary.snapshot.start,
                    end: summary.snapshot.end,
                    change_pct: summary.snapshot.change_pct,
                    trend: summary.snapshot.trend,
                }),
                Err(err) => {
                    errors.push(err.to_partial_error(ChatErrorTarget::Asn { asn, asn_org }))
                }
            }
        }

        ranked.sort_by(|left, right| compare_change_pct(left.change_pct, right.change_pct));
        if order == ChatGrowthRankOrder::Gainers {
            ranked.reverse();
        }
        ranked.truncate(limit);

        Ok(ChatAsnsGrowthRankResponse {
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
    ) -> Result<ChatCompareServersResponse, InsightsError> {
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
        let point_limit = max_points.min(crate::metric::max_points() as usize);

        let futures: Vec<_> = ids
            .iter()
            .map(|&id| self.compare_server_item(id, range, point_limit))
            .collect();
        let results = join_all(futures).await;

        let mut servers = Vec::with_capacity(results.len());
        let mut errors = Vec::new();
        for (&id, result) in ids.iter().zip(results) {
            match result {
                Ok(item) => servers.push(item),
                Err(err) => errors
                    .push(err.to_partial_error(ChatErrorTarget::Server { id: id.to_string() })),
            }
        }

        Ok(ChatCompareServersResponse {
            from: range.from,
            to: range.to,
            servers,
            errors,
        })
    }

    async fn compare_server_item(
        &self,
        id: Uuid,
        range: crate::core::ResolvedTimeRange,
        max_points: usize,
    ) -> Result<ChatCompareServerItem, InsightsError> {
        let server = self
            .catalog
            .server_detail(id)
            .await
            .ok_or_else(|| InsightsError::InvalidRange("server not found".into()))?;
        let snapshot = fetch_server_snapshot(
            &self.insights,
            self.catalog.as_ref(),
            id,
            range.from,
            range.to,
            SERIES_KEY,
            max_points,
        )
        .await?;
        Ok(ChatCompareServerItem {
            id: server.id.to_string(),
            name: server.name,
            snapshot,
        })
    }

    fn parse_range(&self, from: &str, to: &str) -> Result<crate::core::ResolvedTimeRange, InsightsError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        parse_insights_range(from, to, now)
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