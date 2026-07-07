use uuid::Uuid;

use crate::catalog::ServerCatalog;
use crate::error::InsightsError;
use crate::metric::AlignedLane;
use crate::Insights;

use super::queries::build_players_query;
use super::resolution::PlayersResolution;
use super::snapshot::lane_to_snapshot;

pub async fn fetch_server_lane(
    insights: &Insights,
    catalog: &dyn ServerCatalog,
    id: Uuid,
    from: i64,
    to: i64,
    resolution: PlayersResolution,
) -> Result<AlignedLane, InsightsError> {
    if !catalog.server_is_tracked(id).await {
        return Err(InsightsError::InvalidRange("server not found".into()));
    }
    let query = build_players_query(
        resolution,
        catalog.environment(),
        from,
        to,
        Some(&id.to_string()),
        None,
    )?;
    insights.lane(&query).await
}

pub async fn fetch_total_lane(
    insights: &Insights,
    catalog: &dyn ServerCatalog,
    from: i64,
    to: i64,
    resolution: PlayersResolution,
) -> Result<AlignedLane, InsightsError> {
    let query = build_players_query(
        resolution,
        catalog.environment(),
        from,
        to,
        None,
        None,
    )?;
    insights.lane(&query).await
}

pub async fn fetch_asn_lane(
    insights: &Insights,
    catalog: &dyn ServerCatalog,
    asn: &str,
    asn_org: &str,
    from: i64,
    to: i64,
    resolution: PlayersResolution,
) -> Result<AlignedLane, InsightsError> {
    if !catalog.asn_is_tracked(asn, asn_org).await {
        return Err(InsightsError::InvalidRange("asn not found".into()));
    }
    let query = build_players_query(
        resolution,
        catalog.environment(),
        from,
        to,
        None,
        Some((asn, asn_org)),
    )?;
    insights.lane(&query).await
}

pub async fn fetch_server_snapshot(
    insights: &Insights,
    catalog: &dyn ServerCatalog,
    id: Uuid,
    from: i64,
    to: i64,
    series_key: &str,
    max_points: usize,
) -> Result<mc_chat_types::ChatTimeseriesSnapshot, InsightsError> {
    let lane = fetch_server_lane(
        insights,
        catalog,
        id,
        from,
        to,
        PlayersResolution::DailyAverage,
    )
    .await?;
    lane_to_snapshot(from, to, series_key, &lane, max_points)
}

pub async fn fetch_total_snapshot(
    insights: &Insights,
    catalog: &dyn ServerCatalog,
    from: i64,
    to: i64,
    series_key: &str,
    max_points: usize,
) -> Result<mc_chat_types::ChatTimeseriesSnapshot, InsightsError> {
    let lane = fetch_total_lane(
        insights,
        catalog,
        from,
        to,
        PlayersResolution::DailyAverage,
    )
    .await?;
    lane_to_snapshot(from, to, series_key, &lane, max_points)
}

pub async fn fetch_asn_snapshot(
    insights: &Insights,
    catalog: &dyn ServerCatalog,
    asn: &str,
    asn_org: &str,
    from: i64,
    to: i64,
    series_key: &str,
    max_points: usize,
) -> Result<mc_chat_types::ChatTimeseriesSnapshot, InsightsError> {
    let lane = fetch_asn_lane(
        insights,
        catalog,
        asn,
        asn_org,
        from,
        to,
        PlayersResolution::DailyAverage,
    )
    .await?;
    lane_to_snapshot(from, to, series_key, &lane, max_points)
}
