use std::time::Duration;

use mc_common::constants::time::SECONDS_PER_DAY_U64;

use crate::error::InsightsError;
use crate::metric::{
    avg_over_time, per_server_players_series, player_count_series, players_for_asn_series,
    total_players_by_type_series, total_players_series, VmRangeQuery,
};

use super::resolution::PlayersResolution;

const SECONDS_PER_WEEK_U64: u64 = 7 * SECONDS_PER_DAY_U64;

/// Step at which average overlays are sampled: one point per day or per week,
/// instead of the rolling average evaluated at every chart step.
fn resolution_step(resolution: PlayersResolution) -> Option<Duration> {
    match resolution {
        PlayersResolution::Chart => None,
        PlayersResolution::DailyAverage => Some(Duration::from_secs(SECONDS_PER_DAY_U64)),
        PlayersResolution::WeeklyAverage => Some(Duration::from_secs(SECONDS_PER_WEEK_U64)),
    }
}

pub fn build_total_players_by_type_query(
    resolution: PlayersResolution,
    environment: &str,
    platform_type: &str,
    from_epoch: i64,
    to_epoch: i64,
) -> Result<VmRangeQuery, InsightsError> {
    let promql = match resolution {
        PlayersResolution::Chart => total_players_by_type_series(environment, platform_type),
        PlayersResolution::DailyAverage => {
            avg_over_time(&total_players_by_type_series(environment, platform_type), "1d")
        }
        PlayersResolution::WeeklyAverage => {
            avg_over_time(&total_players_by_type_series(environment, platform_type), "7d")
        }
    };

    let mut builder = VmRangeQuery::builder()
        .promql(promql)
        .from_epoch(from_epoch)
        .to_epoch(to_epoch);

    match resolution_step(resolution) {
        Some(step) => builder = builder.step(step),
        None => builder = builder.chart_step(),
    }

    builder.build().map_err(InsightsError::from)
}

pub fn build_players_query(
    resolution: PlayersResolution,
    environment: &str,
    from_epoch: i64,
    to_epoch: i64,
    server_id: Option<&str>,
    asn: Option<(&str, &str)>,
) -> Result<VmRangeQuery, InsightsError> {
    let promql = match (server_id, asn) {
        (Some(id), None) => match resolution {
            PlayersResolution::Chart => player_count_series(environment, id),
            PlayersResolution::DailyAverage => {
                avg_over_time(&player_count_series(environment, id), "1d")
            }
            PlayersResolution::WeeklyAverage => {
                avg_over_time(&player_count_series(environment, id), "7d")
            }
        },
        (None, None) => match resolution {
            PlayersResolution::Chart => total_players_series(environment),
            PlayersResolution::DailyAverage => {
                avg_over_time(&total_players_series(environment), "1d")
            }
            PlayersResolution::WeeklyAverage => {
                avg_over_time(&total_players_series(environment), "7d")
            }
        },
        (None, Some((asn, asn_org))) => match resolution {
            PlayersResolution::Chart => players_for_asn_series(environment, asn, asn_org),
            PlayersResolution::DailyAverage => avg_over_time(
                &players_for_asn_series(environment, asn, asn_org),
                "1d",
            ),
            PlayersResolution::WeeklyAverage => avg_over_time(
                &players_for_asn_series(environment, asn, asn_org),
                "7d",
            ),
        },
        _ => {
            return Err(InsightsError::InvalidRange(
                "invalid players query target".into(),
            ));
        }
    };

    let mut builder = VmRangeQuery::builder()
        .promql(promql)
        .from_epoch(from_epoch)
        .to_epoch(to_epoch);

    match resolution_step(resolution) {
        Some(step) => builder = builder.step(step),
        None => builder = builder.chart_step(),
    }

    builder.build().map_err(InsightsError::from)
}

pub fn build_per_server_players_query(
    environment: &str,
    from_epoch: i64,
    to_epoch: i64,
) -> Result<VmRangeQuery, InsightsError> {
    let promql = per_server_players_series(environment);

    VmRangeQuery::builder()
        .promql(promql)
        .from_epoch(from_epoch)
        .to_epoch(to_epoch)
        .chart_step()
        .build()
        .map_err(InsightsError::from)
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use crate::metric::query::step_for;

    use super::*;

    #[test]
    fn chart_server_query() {
        let from = 1_700_000_000;
        let to = 1_700_003_600;
        let query = build_players_query(
            PlayersResolution::Chart,
            "production",
            from,
            to,
            Some("abc"),
            None,
        )
        .unwrap();
        assert!(query.to_vm_query().unwrap().promql().contains(r#"id="abc""#));
        assert_eq!(query.window().step(), step_for(Duration::from_secs((to - from) as u64)));
    }

    #[test]
    fn daily_server_query_uses_avg_over_time() {
        let from = 1_700_000_000;
        let to = 1_730_000_000;
        let query = build_players_query(
            PlayersResolution::DailyAverage,
            "production",
            from,
            to,
            Some("abc"),
            None,
        )
        .unwrap();
        assert!(query
            .to_vm_query()
            .unwrap()
            .promql()
            .starts_with("avg_over_time("));
        assert_eq!(
            query.window().step(),
            Duration::from_secs(SECONDS_PER_DAY_U64)
        );
    }

    #[test]
    fn weekly_server_query_uses_avg_over_time() {
        let from = 1_700_000_000;
        let to = 1_770_000_000;
        let query = build_players_query(
            PlayersResolution::WeeklyAverage,
            "production",
            from,
            to,
            Some("abc"),
            None,
        )
        .unwrap();
        assert!(query
            .to_vm_query()
            .unwrap()
            .promql()
            .starts_with("avg_over_time("));
        assert_eq!(
            query.window().step(),
            Duration::from_secs(SECONDS_PER_WEEK_U64)
        );
    }
}
