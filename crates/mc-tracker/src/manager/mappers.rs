use std::time::Duration;

use mc_api_types::{
    AdminServerResponse, EntityPeakStats, PeakPlayersRecord, ServerListItemResponse,
    ServersListSortField, SortOrder,
};
use mc_db::model::Server;
use mc_dns::DnsCache;
use mc_settings::SettingsStore;

use super::search::{players_sort_key, AsnAggregateKey};
use super::tracked::TrackedServer;

pub(crate) fn dns_cache_for(store: &SettingsStore) -> Option<DnsCache> {
    store
        .cached_bool(mc_settings::SettingKey::DnsCacheEnabled)
        .then(|| {
            DnsCache::new(Duration::from_secs(
                store.cached_u32(mc_settings::SettingKey::DnsCacheTtlMinutes) as u64 * 60,
            ))
        })
}

pub(crate) fn peak_players_record(
    players: Option<u32>,
    timestamp: Option<i64>,
) -> Option<PeakPlayersRecord> {
    Some(PeakPlayersRecord {
        players: players?,
        timestamp: timestamp?,
    })
}

pub(crate) fn server_list_item(
    server: &TrackedServer,
    peak_24h: Option<f64>,
) -> ServerListItemResponse {
    let id = server.config.id.to_string();
    ServerListItemResponse {
        id,
        name: server.config.name.clone(),
        server_type: server.config.platform.as_str().to_string(),
        host: server.config.host.clone(),
        port: server.config.port,
        asn: server.asn.asn.clone(),
        asn_org: server.asn.asn_org.clone(),
        players_online: server.players_online,
        favicon: server.favicon.clone(),
        peaks: entity_peak_stats_with_all_time(
            peak_24h,
            peak_players_record(server.peak_players, server.peak_players_timestamp),
        ),
    }
}

pub(crate) fn sort_server_list_items(
    servers: &mut [ServerListItemResponse],
    sort: ServersListSortField,
    order: SortOrder,
) {
    match sort {
        ServersListSortField::Players => {
            servers.sort_by(|left, right| {
                let left_players = players_sort_key(left.players_online);
                let right_players = players_sort_key(right.players_online);
                match order {
                    SortOrder::Desc => right_players.cmp(&left_players),
                    SortOrder::Asc => left_players.cmp(&right_players),
                }
            });
        }
        ServersListSortField::Name => {
            servers.sort_by(|left, right| {
                let cmp = left
                    .name
                    .to_lowercase()
                    .cmp(&right.name.to_lowercase())
                    .then_with(|| left.id.cmp(&right.id));
                match order {
                    SortOrder::Asc => cmp,
                    SortOrder::Desc => cmp.reverse(),
                }
            });
        }
    }
}

pub(crate) fn entity_peak_stats_with_all_time(
    players_24h: Option<f64>,
    all_time: Option<PeakPlayersRecord>,
) -> EntityPeakStats {
    EntityPeakStats {
        players_24h,
        all_time,
    }
}

pub(crate) fn asn_peak_all_time(
    servers: &[TrackedServer],
    key: &AsnAggregateKey,
) -> Option<PeakPlayersRecord> {
    use super::search::asn_key;

    servers
        .iter()
        .filter(|server| asn_key(server) == *key)
        .filter_map(|server| {
            peak_players_record(server.peak_players, server.peak_players_timestamp)
        })
        .max_by_key(|peak| peak.players)
}

pub fn admin_server_response(server: &Server) -> AdminServerResponse {
    AdminServerResponse {
        id: server.id.to_string(),
        name: server.name.clone(),
        server_type: server.platform.as_str().to_string(),
        host: server.host.clone(),
        port: server.port,
        created_at: server.created_at.to_rfc3339(),
        updated_at: server.updated_at.to_rfc3339(),
        paused: server.paused,
    }
}
