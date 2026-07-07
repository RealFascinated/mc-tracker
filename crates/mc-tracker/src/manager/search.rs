use mc_search::{matches, score_str, SearchField};

use super::tracked::TrackedServer;

pub(crate) type AsnAggregateKey = mc_insights::AsnPeakKey;

#[derive(Debug, Clone)]
pub(crate) struct AsnAggregate {
    pub key: AsnAggregateKey,
    pub players_online: u64,
    pub server_count: u32,
}

pub(crate) fn server_search_values<'a>(
    server: &'a TrackedServer,
    id: &'a str,
    port: Option<&'a str>,
) -> Vec<&'a str> {
    let mut values = vec![
        server.config.name.as_str(),
        server.config.host.as_str(),
        server.config.platform.as_str(),
        server.asn.asn.as_str(),
        server.asn.asn_org.as_str(),
        id,
    ];
    if let Some(port) = port {
        values.push(port);
    }
    values
}

pub(crate) fn matches_server_search(server: &TrackedServer, search: Option<&str>) -> bool {
    let id = server.config.id.to_string();
    let port = server.config.port.map(|value| value.to_string());
    let values = server_search_values(server, &id, port.as_deref());
    let fields: Vec<SearchField<'_>> = values.iter().map(|v| SearchField::new(v)).collect();
    matches(search, &fields)
}

pub(crate) fn server_search_relevance(server: &TrackedServer, query: &str) -> u8 {
    let id = server.config.id.to_string();
    let port = server.config.port.map(|value| value.to_string());
    let values = server_search_values(server, &id, port.as_deref());
    score_str(query, &values)
}

pub(crate) fn asn_key(server: &TrackedServer) -> AsnAggregateKey {
    AsnAggregateKey {
        asn: server.asn.asn.clone(),
        asn_org: server.asn.asn_org.clone(),
    }
}

pub(crate) fn matches_asn_org(server: &TrackedServer, query: &str) -> bool {
    mc_search::matches_field(query, server.asn.asn_org.as_str())
}

pub(crate) fn matches_asn_key(server: &TrackedServer, asn: &str, asn_org: &str) -> bool {
    server.asn.asn == asn && server.asn.asn_org == asn_org
}

pub(crate) fn matches_asn_search(asn: &AsnAggregateKey, search: Option<&str>) -> bool {
    matches(
        search,
        &[
            SearchField::new(asn.asn.as_str()),
            SearchField::new(asn.asn_org.as_str()),
        ],
    )
}

pub(crate) fn players_sort_key(players: Option<u32>) -> i64 {
    players.map(i64::from).unwrap_or(-1)
}
