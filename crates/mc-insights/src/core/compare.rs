use futures::future::join_all;
use mc_api_types::{
    ApiErrorCode, ErrorTarget, PartialError, ServersCompareTimeseriesResponse, TimeseriesLanes,
};
use uuid::Uuid;

use crate::catalog::ServerCatalog;
use crate::error::InsightsError;
use crate::metric::MetricQueryWindow;
use crate::Insights;

use super::fetch::fetch_server_lane;
use super::queries::build_players_query;
use super::range::parse_chart_epochs;
use super::resolution::PlayersResolution;

pub fn lane_to_timeseries_lanes(
    lane: &crate::metric::AlignedLane,
    window: &MetricQueryWindow,
) -> TimeseriesLanes {
    let mut lanes = TimeseriesLanes::new(window.from_epoch(), window.to_epoch());
    lanes.insert_lane(
        mc_api_types::timeseries_keys::PLAYERS_ONLINE,
        lane.step_secs,
        lane.timestamps.clone(),
        lane.values.clone(),
    );
    lanes
}

pub async fn compare_servers_chart(
    insights: &Insights,
    catalog: &dyn ServerCatalog,
    ids: &[Uuid],
    from: i64,
    to: i64,
) -> Result<ServersCompareTimeseriesResponse, InsightsError> {
    parse_chart_epochs(from, to)?;

    let futures: Vec<_> = ids
        .iter()
        .map(|&id| async move {
            let meta = catalog
                .server_detail(id)
                .await
                .ok_or_else(|| InsightsError::InvalidRange("server not found".into()))?;
            if !catalog.server_is_tracked(id).await {
                return Err(InsightsError::InvalidRange("server not found".into()));
            }
            let lane = fetch_server_lane(
                insights,
                catalog,
                id,
                from,
                to,
                PlayersResolution::Chart,
            )
            .await?;
            let query = build_players_query(
                PlayersResolution::Chart,
                catalog.environment(),
                from,
                to,
                Some(&id.to_string()),
                None,
            )?;
            Ok(mc_api_types::ServersCompareTimeseriesItem {
                id: meta.id.to_string(),
                name: meta.name,
                timeseries: lane_to_timeseries_lanes(&lane, query.window()),
            })
        })
        .collect();

    let results = join_all(futures).await;
    let mut servers = Vec::with_capacity(results.len());
    let mut errors = Vec::new();
    for (&id, result) in ids.iter().zip(results) {
        match result {
            Ok(item) => servers.push(item),
            Err(err) => errors.push(map_partial_error(id, err)),
        }
    }

    Ok(ServersCompareTimeseriesResponse {
        from,
        to,
        servers,
        errors,
    })
}

fn map_partial_error(id: Uuid, err: InsightsError) -> PartialError {
    let (code, message) = match &err {
        InsightsError::InvalidRange(message) => (ApiErrorCode::InvalidRange, message.clone()),
        _ => (ApiErrorCode::InternalError, err.to_string()),
    };
    PartialError::new(code, message, ErrorTarget::Server { id: id.to_string() })
}
