use std::collections::BTreeMap;

use crate::query::promql::vector_selector;
use crate::schema::{METRIC_PLAYER_COUNT, labels};

/// `dashboard.yml` single-server panel:
/// `max by (id, type) (minecraft_server_player_count{id="$server",environment="production"})`
pub fn player_count_series(environment: &str, server_id: &str) -> String {
    format!(
        r#"max by (id, type) ({})"#,
        vector_selector(
            METRIC_PLAYER_COUNT,
            &BTreeMap::from([
                (labels::ENVIRONMENT, environment),
                (labels::ID, server_id),
            ]),
        )
    )
}

/// `dashboard.yml` peak stat:
/// `max_over_time(sum(minecraft_server_player_count{environment="production"})[24h:])`
pub fn peak_players_24h(environment: &str) -> String {
    format!(
        r#"max_over_time(sum({})[24h:])"#,
        vector_selector(
            METRIC_PLAYER_COUNT,
            &BTreeMap::from([(labels::ENVIRONMENT, environment)]),
        )
    )
}

/// `dashboard.yml` peak stat:
/// `max_over_time(sum(minecraft_server_player_count{environment="production"})[30d:])`
pub fn peak_players_30d(environment: &str) -> String {
    format!(
        r#"max_over_time(sum({})[30d:])"#,
        vector_selector(
            METRIC_PLAYER_COUNT,
            &BTreeMap::from([(labels::ENVIRONMENT, environment)]),
        )
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn peak_players_24h_matches_dashboard_shape() {
        assert_eq!(
            peak_players_24h("production"),
            r#"max_over_time(sum(minecraft_server_player_count{environment="production"})[24h:])"#
        );
    }

    #[test]
    fn peak_players_30d_matches_dashboard_shape() {
        assert_eq!(
            peak_players_30d("production"),
            r#"max_over_time(sum(minecraft_server_player_count{environment="production"})[30d:])"#
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
}
