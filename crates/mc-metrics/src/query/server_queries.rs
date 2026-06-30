use std::collections::BTreeMap;

use crate::query::promql::vector_selector;
use crate::schema::{labels, METRIC_PLAYER_COUNT};

/// Lookback for all-time peak stats (~10 years).
const ALL_TIME_RANGE: &str = "3650d";
/// Subquery resolution for all-time peaks. Must stay under VictoriaMetrics'
/// `-search.maxPointsSubqueryPerTimeseries` (default 100k); 3650d at 1h ≈ 87.6k points.
const ALL_TIME_SUBQUERY_STEP: &str = "1h";

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

/// `sum(minecraft_server_player_count{environment="production"})`
pub fn total_players_series(environment: &str) -> String {
    format!(
        r#"sum({})"#,
        vector_selector(
            METRIC_PLAYER_COUNT,
            &BTreeMap::from([(labels::ENVIRONMENT, environment)]),
        )
    )
}

/// `max_over_time(sum(minecraft_server_player_count{environment="production"})[3650d:1h])`
pub fn peak_players_all_time(environment: &str) -> String {
    peak_all_time_rollup("max_over_time", environment, None)
}

/// `tmax_over_time(sum(minecraft_server_player_count{environment="production"})[3650d:1h])`
pub fn peak_players_all_time_at(environment: &str) -> String {
    peak_all_time_rollup("tmax_over_time", environment, None)
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

/// `max_over_time(max by (id, type) (minecraft_server_player_count{id="$server",...})[24h:])`
pub fn peak_players_24h_for_server(environment: &str, server_id: &str) -> String {
    format!(
        r#"max_over_time({}[24h:])"#,
        player_count_series(environment, server_id)
    )
}

/// `max_over_time(max by (id, type) (minecraft_server_player_count{id="$server",...})[3650d:1h])`
pub fn peak_players_all_time_for_server(environment: &str, server_id: &str) -> String {
    peak_all_time_rollup(
        "max_over_time",
        environment,
        Some(player_count_series(environment, server_id)),
    )
}

/// `tmax_over_time(max by (id, type) (minecraft_server_player_count{id="$server",...})[3650d:1h])`
pub fn peak_players_all_time_at_for_server(environment: &str, server_id: &str) -> String {
    peak_all_time_rollup(
        "tmax_over_time",
        environment,
        Some(player_count_series(environment, server_id)),
    )
}

fn peak_all_time_rollup(
    rollup: &str,
    environment: &str,
    server_series: Option<String>,
) -> String {
    let inner = server_series.unwrap_or_else(|| {
        format!(
            "sum({})",
            vector_selector(
                METRIC_PLAYER_COUNT,
                &BTreeMap::from([(labels::ENVIRONMENT, environment)]),
            )
        )
    });

    format!(
        r#"{rollup}({inner}[{ALL_TIME_RANGE}:{ALL_TIME_SUBQUERY_STEP}])"#
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

    #[test]
    fn total_players_series_matches_aggregate_shape() {
        assert_eq!(
            total_players_series("production"),
            r#"sum(minecraft_server_player_count{environment="production"})"#
        );
    }

    #[test]
    fn peak_players_all_time_uses_coarse_subquery_step() {
        assert_eq!(
            peak_players_all_time("production"),
            r#"max_over_time(sum(minecraft_server_player_count{environment="production"})[3650d:1h])"#
        );
    }

    #[test]
    fn peak_players_all_time_at_uses_coarse_subquery_step() {
        assert_eq!(
            peak_players_all_time_at("production"),
            r#"tmax_over_time(sum(minecraft_server_player_count{environment="production"})[3650d:1h])"#
        );
    }

    #[test]
    fn peak_players_all_time_for_server_uses_coarse_subquery_step() {
        let server_id = "550e8400-e29b-41d4-a716-446655440000";
        assert_eq!(
            peak_players_all_time_for_server("production", server_id),
            format!(
                r#"max_over_time(max by (id, type) (minecraft_server_player_count{{environment="production",id="{server_id}"}})[3650d:1h])"#
            )
        );
    }

    #[test]
    fn peak_players_all_time_at_for_server_uses_coarse_subquery_step() {
        let server_id = "550e8400-e29b-41d4-a716-446655440000";
        assert_eq!(
            peak_players_all_time_at_for_server("production", server_id),
            format!(
                r#"tmax_over_time(max by (id, type) (minecraft_server_player_count{{environment="production",id="{server_id}"}})[3650d:1h])"#
            )
        );
    }

    #[test]
    fn peak_queries_match_dashboard_yml_expressions() {
        let peak_24h = peak_players_24h("production");
        let peak_30d = peak_players_30d("production");

        // Normalized from dashboard.yml panels (whitespace collapsed).
        assert_eq!(
            peak_24h,
            "max_over_time(sum(minecraft_server_player_count{environment=\"production\"})[24h:])"
        );
        assert_eq!(
            peak_30d,
            "max_over_time(sum(minecraft_server_player_count{environment=\"production\"})[30d:])"
        );
    }
}
