use std::time::Duration;

use mc_api_types::{
    AdminServerResponse, EntityPeakStats, PeakPlayersRecord, ServerListItemResponse,
    ServersListSortField, SettingsResponse, SortOrder,
};
use mc_db::model::settings_constants::LLM_API_KEY_MASK;
use mc_db::model::Server;
use mc_db::AppSettings;
use mc_dns::DnsCache;
use mc_metrics::labels;

use super::search::{players_sort_key, AsnAggregateKey};
use super::tracked::TrackedServer;

pub(crate) fn dns_cache_for(settings: &AppSettings) -> Option<DnsCache> {
    settings.dns_cache_enabled.then(|| {
        DnsCache::new(Duration::from_secs(
            settings.dns_cache_ttl_minutes as u64 * 60,
        ))
    })
}

pub(crate) fn label_value(
    labels: &serde_json::Map<String, serde_json::Value>,
    key: &str,
) -> Option<String> {
    labels
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::to_owned)
}

pub(crate) fn asn_key_from_labels(
    labels: &serde_json::Map<String, serde_json::Value>,
) -> Option<AsnAggregateKey> {
    Some(AsnAggregateKey {
        asn: label_value(labels, labels::ASN)?,
        asn_org: label_value(labels, labels::ASN_ORG).unwrap_or_default(),
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

pub fn settings_response(settings: &AppSettings) -> SettingsResponse {
    SettingsResponse {
        pinger_timeout_ms: settings.pinger_timeout_ms,
        pinger_retry_attempts: settings.pinger_retry_attempts,
        pinger_retry_delay_ms: settings.pinger_retry_delay_ms,
        dns_cache_enabled: settings.dns_cache_enabled,
        dns_cache_ttl_minutes: settings.dns_cache_ttl_minutes,
        victoriametrics_url: settings.victoriametrics_url.clone(),
        metrics_push_cron: settings.metrics_push_cron.clone(),
        sign_up_enabled: settings.sign_up_enabled,
        www_origin: settings.www_origin.clone(),
        llm_base_url: settings.llm_base_url.clone(),
        llm_model: settings.llm_model.clone(),
        llm_max_tool_rounds: settings.llm_max_tool_rounds,
        llm_context_max_turns: settings.llm_context_max_turns,
        llm_tool_max_tokens: settings.llm_tool_max_tokens,
        llm_final_max_tokens: settings.llm_final_max_tokens,
        llm_context_max: settings.llm_context_max,
        llm_context_reserve: settings.llm_context_reserve,
        llm_timeout_secs: settings.llm_timeout_secs,
        llm_provider: settings.llm_provider.clone(),
        llm_parallel_slots: settings.llm_parallel_slots,
        llm_api_key: settings
            .llm_api_key_configured()
            .then(|| LLM_API_KEY_MASK.to_string()),
    }
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
