use std::collections::BTreeMap;

use crate::metric::query::promql::vector_selector;
use crate::metric::schema::{labels, METRIC_PLAYER_COUNT};

fn deduped_players_by_asn(environment: &str) -> String {
    format!(
        r#"max by (id, type, asn, asn_org) ({})"#,
        vector_selector(
            METRIC_PLAYER_COUNT,
            &BTreeMap::from([(labels::ENVIRONMENT, environment)]),
        )
    )
}

/// `sum by (asn, asn_org) (max by (id, type, asn, asn_org) (...))`
fn players_by_asn_series(environment: &str) -> String {
    format!(
        r#"sum by (asn, asn_org) ({})"#,
        deduped_players_by_asn(environment)
    )
}

pub fn players_for_asn_series(environment: &str, asn: &str, asn_org: &str) -> String {
    let mut label_map = BTreeMap::from([(labels::ENVIRONMENT, environment)]);
    if !asn.is_empty() {
        label_map.insert(labels::ASN, asn);
    }
    if !asn_org.is_empty() {
        label_map.insert(labels::ASN_ORG, asn_org);
    }

    format!(
        r#"sum by (asn, asn_org) (max by (id, type, asn, asn_org) ({}))"#,
        vector_selector(METRIC_PLAYER_COUNT, &label_map)
    )
}

/// `max_over_time(sum by (asn, asn_org) (...)[24h:])` — one series per ASN.
pub fn peak_players_24h_by_asn(environment: &str) -> String {
    format!(
        r#"max_over_time({}[24h:])"#,
        players_by_asn_series(environment)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn players_by_asn_series_matches_dashboard_shape() {
        assert_eq!(
            players_by_asn_series("production"),
            r#"sum by (asn, asn_org) (max by (id, type, asn, asn_org) (minecraft_server_player_count{environment="production"}))"#
        );
    }

    #[test]
    fn players_for_asn_series_filters_by_org() {
        assert_eq!(
            players_for_asn_series("production", "AS13335", "Cloudflare"),
            r#"sum by (asn, asn_org) (max by (id, type, asn, asn_org) (minecraft_server_player_count{asn="AS13335",asn_org="Cloudflare",environment="production"}))"#
        );
    }
}
