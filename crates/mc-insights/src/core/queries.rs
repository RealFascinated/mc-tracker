use std::time::Duration;

use mc_common::constants::time::SECONDS_PER_DAY;

use crate::error::InsightsError;
use crate::metric::{
    avg_over_time, player_count_series, players_for_asn_series, total_players_series, VmRangeQuery,
};

use super::resolution::PlayersResolution;

fn daily_step() -> Duration {
    Duration::from_secs(SECONDS_PER_DAY as u64)
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
        },
        (None, None) => match resolution {
            PlayersResolution::Chart => total_players_series(environment),
            PlayersResolution::DailyAverage => {
                avg_over_time(&total_players_series(environment), "1d")
            }
        },
        (None, Some((asn, asn_org))) => match resolution {
            PlayersResolution::Chart => players_for_asn_series(environment, asn, asn_org),
            PlayersResolution::DailyAverage => avg_over_time(
                &players_for_asn_series(environment, asn, asn_org),
                "1d",
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

    match resolution {
        PlayersResolution::Chart => builder = builder.chart_step(),
        PlayersResolution::DailyAverage => builder = builder.step(daily_step()),
    }

    builder.build().map_err(InsightsError::from)
}

#[cfg(test)]
mod tests {
    use crate::metric::min_step;

    use super::*;

    #[test]
    fn chart_server_query() {
        let query = build_players_query(
            PlayersResolution::Chart,
            "production",
            1_700_000_000,
            1_700_003_600,
            Some("abc"),
            None,
        )
        .unwrap();
        assert!(query.to_vm_query().unwrap().promql().contains(r#"id="abc""#));
        assert_eq!(query.window().step(), min_step());
    }

    #[test]
    fn daily_server_query_uses_avg_over_time() {
        let query = build_players_query(
            PlayersResolution::DailyAverage,
            "production",
            1_700_000_000,
            1_730_000_000,
            Some("abc"),
            None,
        )
        .unwrap();
        assert!(query
            .to_vm_query()
            .unwrap()
            .promql()
            .starts_with("avg_over_time("));
        assert_eq!(query.window().step(), daily_step());
    }
}
