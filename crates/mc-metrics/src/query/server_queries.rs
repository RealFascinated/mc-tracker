use std::collections::BTreeMap;

use crate::query::promql::vector_selector;
use crate::schema::{labels, METRIC_PLAYER_COUNT};

fn player_count_by_environment(environment: &str) -> String {
    vector_selector(
        METRIC_PLAYER_COUNT,
        &BTreeMap::from([(labels::ENVIRONMENT, environment)]),
    )
}

fn player_count_by_server(environment: &str) -> String {
    format!(
        r#"max by (id, type) ({})"#,
        player_count_by_environment(environment)
    )
}

/// `dashboard.yml` single-server panel:
/// `max by (id, type) (minecraft_server_player_count{id="$server",environment="production"})`
pub fn player_count_series(environment: &str, server_id: &str) -> String {
    format!(
        r#"max by (id, type) ({})"#,
        vector_selector(
            METRIC_PLAYER_COUNT,
            &BTreeMap::from([(labels::ENVIRONMENT, environment), (labels::ID, server_id),]),
        )
    )
}

/// One daily average sample per UTC day for a single tracked server.
pub fn player_count_daily_average_series(environment: &str, server_id: &str) -> String {
    format!(
        r#"avg_over_time({}[1d:])"#,
        player_count_series(environment, server_id)
    )
}

fn total_players_aggregate(environment: &str) -> String {
    format!(r#"sum({})"#, player_count_by_server(environment))
}

/// `max_over_time(sum(max by (id, type) (...))[24h:])`
pub fn peak_players_24h(environment: &str) -> String {
    format!(
        r#"max_over_time({}[24h:])"#,
        total_players_aggregate(environment)
    )
}

/// `max_over_time(sum(max by (id, type) (...))[7d:])`
pub fn peak_players_7d(environment: &str) -> String {
    format!(
        r#"max_over_time({}[7d:])"#,
        total_players_aggregate(environment)
    )
}

/// `sum(max by (id, type) (minecraft_server_player_count{environment="production"}))`
pub fn total_players_series(environment: &str) -> String {
    total_players_aggregate(environment)
}

/// `max_over_time(max by (id, type) (...)[24h:])` — one series per tracked server.
pub fn peak_players_24h_by_server(environment: &str) -> String {
    format!(
        r#"max_over_time({}[24h:])"#,
        player_count_by_server(environment)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn peak_players_24h_matches_dashboard_shape() {
        assert_eq!(
            peak_players_24h("production"),
            r#"max_over_time(sum(max by (id, type) (minecraft_server_player_count{environment="production"}))[24h:])"#
        );
    }

    #[test]
    fn peak_players_7d_matches_expected_shape() {
        assert_eq!(
            peak_players_7d("production"),
            r#"max_over_time(sum(max by (id, type) (minecraft_server_player_count{environment="production"}))[7d:])"#
        );
    }

    #[test]
    fn player_count_series_matches_dashboard_shape() {
        let query = player_count_series("production", "550e8400-e29b-41d4-a716-446655440000");
        assert_eq!(
            query,
            r#"max by (id, type) (minecraft_server_player_count{environment="production",id="550e8400-e29b-41d4-a716-446655440000"})"#
        );
    }

    #[test]
    fn player_count_daily_average_series_matches_expected_shape() {
        let query =
            player_count_daily_average_series("production", "550e8400-e29b-41d4-a716-446655440000");
        assert_eq!(
            query,
            r#"avg_over_time(max by (id, type) (minecraft_server_player_count{environment="production",id="550e8400-e29b-41d4-a716-446655440000"})[1d:])"#
        );
    }

    #[test]
    fn total_players_series_matches_aggregate_shape() {
        assert_eq!(
            total_players_series("production"),
            r#"sum(max by (id, type) (minecraft_server_player_count{environment="production"}))"#
        );
    }
}
