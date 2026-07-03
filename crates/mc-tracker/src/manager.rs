mod mappers;
mod metrics;
mod ping;
mod push;
mod search;
mod timeseries;
mod tracked;

pub use mappers::{admin_server_response, settings_response};
pub use push::{spawn_push_loop, PushLoopHandle};
pub use tracked::{ServerSummary, TrackedServer};

use self::mappers::{
    asn_peak_all_time, dns_cache_for, entity_peak_stats_with_all_time, server_list_item,
    sort_server_list_items,
};
use self::search::{
    asn_key, matches_asn_key, matches_asn_org, matches_asn_search, matches_server_search,
    players_sort_key, server_search_relevance, AsnAggregate, AsnAggregateKey,
};
use self::tracked::accumulate_summary;

use std::collections::BTreeMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use mc_api_types::{
    AdminServersListResponse, AsnDetailResponse, AsnListItemResponse, AsnSearchResponse,
    AsnsListResponse, AsnsSummaryResponse, IpLookupResponse, PlayersPeakSummary,
    ServerListItemResponse, ServerSearchItemResponse, ServersListResponse, ServersListSortField,
    ServersSearchResponse, ServersSummaryResponse, SortOrder,
};
use mc_common::constants::limits::DEFAULT_LIST_LIMIT;
use mc_db::model::Server;
use mc_db::AppSettings;
use mc_db::DbPool;
use mc_dns::{DnsResolver, HickoryDnsResolver};
use mc_geo::{AsnLookup, GeoService};
use mc_metrics::{
    peak_players_24h, peak_players_7d, PlayerCountRegistry, VmPushClient, VmQueryClient,
};
use tokio::sync::RwLock;
use uuid::Uuid;

pub struct ServerManager {
    pub(crate) pool: Option<DbPool>,
    pub(crate) servers: RwLock<Vec<TrackedServer>>,
    pub(crate) settings: Arc<RwLock<AppSettings>>,
    pub(crate) metrics_environment: String,
    pub(crate) dns: RwLock<HickoryDnsResolver>,
    pub(crate) geo: Arc<GeoService>,
    pub(crate) metrics: RwLock<PlayerCountRegistry>,
    pub(crate) push_client: RwLock<VmPushClient>,
    pub(crate) query_client: RwLock<VmQueryClient>,
    pub(crate) vm_auth_token: Option<String>,
    pub(crate) pushing: AtomicBool,
}

impl ServerManager {
    pub fn new(
        servers: Vec<Server>,
        pool: Option<DbPool>,
        settings: Arc<RwLock<AppSettings>>,
        geo: Arc<GeoService>,
        vm_auth_token: Option<String>,
        bootstrap_settings: &AppSettings,
        metrics_environment: impl Into<String>,
    ) -> Self {
        let metrics_environment = metrics_environment.into();
        Self {
            pool,
            servers: RwLock::new(
                servers
                    .into_iter()
                    .map(TrackedServer::from_config)
                    .collect(),
            ),
            settings,
            metrics_environment: metrics_environment.clone(),
            dns: RwLock::new(HickoryDnsResolver::new(dns_cache_for(bootstrap_settings))),
            geo,
            metrics: RwLock::new(PlayerCountRegistry::new(&metrics_environment)),
            push_client: RwLock::new(VmPushClient::new(
                bootstrap_settings.victoriametrics_import_url(),
                vm_auth_token.clone(),
            )),
            query_client: RwLock::new(VmQueryClient::new(
                bootstrap_settings.victoriametrics_base_url(),
                vm_auth_token.clone(),
            )),
            vm_auth_token,
            pushing: AtomicBool::new(false),
        }
    }

    pub fn environment(&self) -> &str {
        &self.metrics_environment
    }

    pub async fn get_tracked(&self, id: Uuid) -> Option<TrackedServer> {
        self.servers
            .read()
            .await
            .iter()
            .find(|server| server.config.id == id)
            .cloned()
    }

    pub async fn append_server(&self, config: Server) {
        self.servers
            .write()
            .await
            .push(TrackedServer::from_config(config));
    }

    pub async fn update_server_config(&self, config: Server) -> bool {
        let mut servers = self.servers.write().await;
        let Some(server) = servers.iter_mut().find(|s| s.config.id == config.id) else {
            return false;
        };

        let identity_changed = server.config.host != config.host
            || server.config.port != config.port
            || server.config.platform != config.platform;
        let pause_changed = server.config.paused != config.paused;

        server.config = config.clone();
        server.peak_players = config.peak_players;
        server.peak_players_timestamp = config.peak_players_timestamp;
        if identity_changed || pause_changed {
            server.clear_ping_state();
            server.asn = AsnLookup::empty();
            server.last_asn_ip = None;
        }
        true
    }

    pub async fn remove_server(&self, id: Uuid) -> bool {
        let mut servers = self.servers.write().await;
        let index = servers.iter().position(|server| server.config.id == id);
        if let Some(index) = index {
            servers.remove(index);
            true
        } else {
            false
        }
    }

    pub async fn admin_servers_list(&self) -> AdminServersListResponse {
        let servers = self
            .servers
            .read()
            .await
            .iter()
            .map(|server| admin_server_response(&server.config))
            .collect();
        AdminServersListResponse { servers }
    }

    pub async fn summary(&self) -> ServerSummary {
        let servers = self.servers.read().await;
        accumulate_summary(servers.iter().filter(|server| server.is_tracking()))
    }

    pub async fn servers_list_response(
        &self,
        search: Option<&str>,
        sort: ServersListSortField,
        order: SortOrder,
    ) -> ServersListResponse {
        let summary = self.summary().await;
        let all_tracked = self.servers.read().await.clone();
        let tracked = all_tracked
            .iter()
            .filter(|server| server.is_tracking())
            .filter(|server| matches_server_search(server, search))
            .cloned()
            .collect::<Vec<_>>();

        let environment = self.environment();
        let (peak_players24h, peak_players_7d, peaks_24h) = tokio::join!(
            self.query_scalar(peak_players_24h),
            self.query_scalar(peak_players_7d),
            self.peaks_24h_by_server_id(environment),
        );

        let mut servers = Vec::with_capacity(tracked.len());
        for server in tracked {
            let id = server.config.id.to_string();
            servers.push(server_list_item(&server, peaks_24h.get(&id).copied()));
        }

        sort_server_list_items(&mut servers, sort, order);

        ServersListResponse {
            summary: ServersSummaryResponse {
                total_players: summary.total_players,
                players_pc: summary.players_pc,
                players_pe: summary.players_pe,
                tracked_servers: summary.tracked_servers,
                peaks: PlayersPeakSummary {
                    players_24h: peak_players24h,
                    players_7d: peak_players_7d,
                },
            },
            servers,
        }
    }

    async fn servers_by_asn_org(&self, query: &str, limit: u32) -> (ServersListResponse, bool) {
        let limit = limit.clamp(1, DEFAULT_LIST_LIMIT) as usize;
        let all_tracked = self.servers.read().await.clone();
        let mut tracked: Vec<_> = all_tracked
            .iter()
            .filter(|server| server.is_tracking())
            .filter(|server| matches_asn_org(server, query))
            .cloned()
            .collect();

        let summary = accumulate_summary(&tracked);

        tracked.sort_by(|left, right| {
            let left_players = players_sort_key(left.players_online);
            let right_players = players_sort_key(right.players_online);
            right_players
                .cmp(&left_players)
                .then_with(|| left.config.name.cmp(&right.config.name))
        });

        let truncated = tracked.len() > limit;
        if truncated {
            tracked.truncate(limit);
        }

        let environment = self.environment();
        let peaks_24h = self.peaks_24h_by_server_id(environment).await;

        let servers = tracked
            .into_iter()
            .map(|server| {
                let id = server.config.id.to_string();
                server_list_item(&server, peaks_24h.get(&id).copied())
            })
            .collect();

        (
            ServersListResponse {
                summary: ServersSummaryResponse {
                    total_players: summary.total_players,
                    players_pc: summary.players_pc,
                    players_pe: summary.players_pe,
                    tracked_servers: summary.tracked_servers,
                    peaks: PlayersPeakSummary {
                        players_24h: None,
                        players_7d: None,
                    },
                },
                servers,
            },
            truncated,
        )
    }

    pub async fn search_asns_response(&self, query: &str, limit: u32) -> AsnSearchResponse {
        let limit = limit.clamp(1, DEFAULT_LIST_LIMIT);
        let mut matching_networks = self.asns_list_response(Some(query)).await;
        let networks_truncated = matching_networks.asns.len() > limit as usize;
        if networks_truncated {
            matching_networks.asns.truncate(limit as usize);
        }
        let (servers_with_asn_org, org_servers_truncated) =
            self.servers_by_asn_org(query, limit).await;
        AsnSearchResponse {
            query: query.to_string(),
            matching_networks,
            networks_truncated,
            servers_with_asn_org,
            org_servers_truncated,
        }
    }

    pub async fn server_detail_response(&self, id: Uuid) -> Option<ServerListItemResponse> {
        let server = self.get_tracked(id).await?;
        if !server.is_tracking() {
            return None;
        }
        let environment = self.environment();
        let id_str = id.to_string();
        let peaks_24h = self.peaks_24h_by_server_id(environment).await;

        Some(server_list_item(&server, peaks_24h.get(&id_str).copied()))
    }

    pub async fn server_list_items_by_ids(&self, ids: &[Uuid]) -> Vec<ServerListItemResponse> {
        if ids.is_empty() {
            return Vec::new();
        }

        let environment = self.environment();
        let peaks_24h = self.peaks_24h_by_server_id(environment).await;
        let servers = self.servers.read().await;

        ids.iter()
            .filter_map(|id| {
                let server = servers
                    .iter()
                    .find(|server| server.config.id == *id && server.is_tracking())?;
                let id_str = id.to_string();
                Some(server_list_item(server, peaks_24h.get(&id_str).copied()))
            })
            .collect()
    }

    pub async fn is_server_tracked(&self, id: Uuid) -> bool {
        self.get_tracked(id)
            .await
            .is_some_and(|server| server.is_tracking())
    }

    pub async fn servers_search_response(
        &self,
        search: Option<&str>,
        limit: u32,
    ) -> ServersSearchResponse {
        let Some(query) = search.map(str::trim).filter(|value| !value.is_empty()) else {
            return ServersSearchResponse {
                servers: Vec::new(),
            };
        };

        let limit = limit.clamp(1, DEFAULT_LIST_LIMIT) as usize;
        let servers = self.servers.read().await;

        let mut matches: Vec<_> = servers
            .iter()
            .filter(|server| server.is_tracking())
            .filter(|server| matches_server_search(server, Some(query)))
            .collect();

        matches.sort_by(|left, right| {
            let left_score = server_search_relevance(left, query);
            let right_score = server_search_relevance(right, query);
            right_score
                .cmp(&left_score)
                .then_with(|| {
                    let left_players = players_sort_key(left.players_online);
                    let right_players = players_sort_key(right.players_online);
                    right_players.cmp(&left_players)
                })
                .then_with(|| left.config.name.cmp(&right.config.name))
        });

        let servers = matches
            .into_iter()
            .take(limit)
            .map(|server| ServerSearchItemResponse {
                id: server.config.id.to_string(),
                name: server.config.name.clone(),
                server_type: server.config.platform.as_str().to_string(),
                host: server.config.host.clone(),
                port: server.config.port,
                favicon: server.favicon.clone(),
                players_online: server.players_online,
            })
            .collect();

        ServersSearchResponse { servers }
    }

    pub async fn asns_list_response(&self, search: Option<&str>) -> AsnsListResponse {
        let summary = self.summary().await;
        let all_tracked = self.servers.read().await.clone();
        let tracked = all_tracked.clone();

        let mut aggregates: BTreeMap<AsnAggregateKey, AsnAggregate> = BTreeMap::new();
        for server in tracked.iter().filter(|server| server.is_tracking()) {
            let key = asn_key(server);
            if !matches_asn_search(&key, search) {
                continue;
            }

            let entry = aggregates
                .entry(key.clone())
                .or_insert_with(|| AsnAggregate {
                    key: key.clone(),
                    players_online: 0,
                    server_count: 0,
                });
            entry.server_count += 1;
            if let Some(players) = server.players_online {
                entry.players_online += players as u64;
            }
        }

        let environment = self.environment();
        let (peak_players24h, peak_players_7d, peaks_24h) = tokio::join!(
            self.query_scalar(peak_players_24h),
            self.query_scalar(peak_players_7d),
            self.peaks_24h_by_asn_key(environment),
        );

        let mut asns = Vec::with_capacity(aggregates.len());
        for aggregate in aggregates.into_values() {
            asns.push(AsnListItemResponse {
                asn: aggregate.key.asn.clone(),
                asn_org: aggregate.key.asn_org.clone(),
                players_online: aggregate.players_online.min(u32::MAX as u64) as u32,
                server_count: aggregate.server_count,
                peaks: entity_peak_stats_with_all_time(
                    peaks_24h.get(&aggregate.key).copied(),
                    asn_peak_all_time(&all_tracked, &aggregate.key),
                ),
            });
        }

        asns.sort_by_key(|asn| std::cmp::Reverse(asn.players_online));

        AsnsListResponse {
            summary: AsnsSummaryResponse {
                total_players: summary.total_players,
                players_pc: summary.players_pc,
                players_pe: summary.players_pe,
                tracked_asns: asns.len() as u32,
                tracked_servers: summary.tracked_servers,
                peaks: PlayersPeakSummary {
                    players_24h: peak_players24h,
                    players_7d: peak_players_7d,
                },
            },
            asns,
        }
    }

    pub async fn asn_detail_response(&self, asn: &str, asn_org: &str) -> Option<AsnDetailResponse> {
        let all_tracked = self.servers.read().await.clone();
        let tracked: Vec<_> = all_tracked
            .iter()
            .filter(|server| server.is_tracking())
            .filter(|server| matches_asn_key(server, asn, asn_org))
            .cloned()
            .collect();

        if tracked.is_empty() {
            return None;
        }

        let summary = accumulate_summary(&tracked);

        let key = AsnAggregateKey {
            asn: asn.to_string(),
            asn_org: asn_org.to_string(),
        };
        let environment = self.environment();
        let (peaks_24h_by_server, peaks_24h_by_asn) = tokio::join!(
            self.peaks_24h_by_server_id(environment),
            self.peaks_24h_by_asn_key(environment),
        );
        let asn_peak_24h = peaks_24h_by_asn.get(&key).copied();
        let entity_peaks =
            entity_peak_stats_with_all_time(asn_peak_24h, asn_peak_all_time(&all_tracked, &key));

        let mut servers = Vec::with_capacity(tracked.len());
        for server in tracked {
            let id = server.config.id.to_string();
            servers.push(server_list_item(
                &server,
                peaks_24h_by_server.get(&id).copied(),
            ));
        }

        servers.sort_by(|left, right| {
            let left_players = players_sort_key(left.players_online);
            let right_players = players_sort_key(right.players_online);
            right_players.cmp(&left_players)
        });

        Some(AsnDetailResponse {
            asn: asn.to_string(),
            asn_org: asn_org.to_string(),
            players_online: summary.total_players.min(u32::MAX as u64) as u32,
            server_count: summary.tracked_servers,
            peaks: entity_peaks.clone(),
            summary: ServersSummaryResponse {
                total_players: summary.total_players,
                players_pc: summary.players_pc,
                players_pe: summary.players_pe,
                tracked_servers: summary.tracked_servers,
                peaks: PlayersPeakSummary {
                    players_24h: asn_peak_24h,
                    players_7d: None,
                },
            },
            servers,
        })
    }

    pub async fn ip_lookup_response(&self, query: &str) -> Result<IpLookupResponse, String> {
        let query = query.trim();
        if query.is_empty() {
            return Err("query must not be empty".into());
        }

        let ip = if query.parse::<std::net::IpAddr>().is_ok() {
            query.to_string()
        } else {
            let dns = self.dns.read().await;
            dns.resolve_a(query)
                .await
                .map_err(|err| err.to_string())?
                .ok_or_else(|| format!("could not resolve hostname: {query}"))?
        };

        let lookup = self
            .geo
            .lookup_asn(&ip)
            .await
            .map_err(|err| err.to_string())?;

        Ok(IpLookupResponse {
            query: query.to_string(),
            ip,
            asn: lookup.asn,
            asn_org: lookup.asn_org,
            cidr: lookup.cidr,
        })
    }

    pub async fn settings(&self) -> AppSettings {
        self.settings.read().await.clone()
    }

    pub async fn apply_settings(&self, updated: AppSettings) {
        let (dns_changed, vm_url_changed) = {
            let current = self.settings.read().await;
            (
                current.dns_cache_enabled != updated.dns_cache_enabled
                    || current.dns_cache_ttl_minutes != updated.dns_cache_ttl_minutes,
                current.victoriametrics_url != updated.victoriametrics_url,
            )
        };
        *self.settings.write().await = updated.clone();
        if dns_changed {
            let settings = self.settings.read().await;
            *self.dns.write().await = HickoryDnsResolver::new(dns_cache_for(&settings));
        }
        if vm_url_changed {
            self.refresh_vm_clients(&updated).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use mc_common::now_ms;
    use mc_db::model::Platform;
    use mc_db::model::Server;
    use mc_test_support::fixture_geo;
    use std::time::Duration;

    fn sample_server() -> Server {
        Server {
            id: Uuid::new_v4(),
            name: "Test".into(),
            host: "127.0.0.1".into(),
            port: Some(25565),
            platform: Platform::Pc,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            peak_players: None,
            peak_players_timestamp: None,
            paused: false,
        }
    }

    #[tokio::test]
    async fn loads_servers_into_memory() {
        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let bootstrap = settings.read().await.clone();
        let manager = ServerManager::new(
            vec![sample_server(), sample_server()],
            None,
            settings,
            fixture_geo(),
            None,
            &bootstrap,
            "development",
        );
        assert_eq!(manager.summary().await.tracked_servers, 2);
    }

    #[tokio::test]
    async fn summary_counts_only_online_servers() {
        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let bootstrap = settings.read().await.clone();
        let manager = ServerManager::new(
            vec![sample_server()],
            None,
            settings,
            fixture_geo(),
            None,
            &bootstrap,
            "development",
        );
        {
            let mut servers = manager.servers.write().await;
            servers[0].players_online = Some(10);
            servers[0].last_ping_at = Some(now_ms());
            servers[0].config.platform = Platform::Pc;
        }
        let summary = manager.summary().await;
        assert_eq!(summary.total_players, 10);
        assert_eq!(summary.players_pc, 10);
        assert_eq!(summary.tracked_servers, 1);
    }

    #[tokio::test]
    async fn append_update_and_remove_server() {
        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let bootstrap = settings.read().await.clone();
        let manager = ServerManager::new(
            vec![],
            None,
            settings,
            fixture_geo(),
            None,
            &bootstrap,
            "development",
        );

        let server = sample_server();
        let id = server.id;
        manager.append_server(server).await;
        assert_eq!(manager.summary().await.tracked_servers, 1);
        {
            let mut servers = manager.servers.write().await;
            servers[0].players_online = Some(42);
        }

        let updated = Server {
            name: "Renamed".into(),
            host: "example.com".into(),
            port: None,
            ..sample_server_with_id(id)
        };
        assert!(manager.update_server_config(updated.clone()).await);
        let tracked = manager.get_tracked(id).await.unwrap();
        assert_eq!(tracked.config.name, "Renamed");
        assert_eq!(tracked.config.host, "example.com");
        assert!(tracked.players_online.is_none());

        assert!(manager.remove_server(id).await);
        assert_eq!(manager.summary().await.tracked_servers, 0);
        assert!(!manager.remove_server(id).await);
    }

    #[tokio::test]
    async fn paused_servers_are_excluded_from_public_summary() {
        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let bootstrap = settings.read().await.clone();
        let active = sample_server();
        let paused = Server {
            paused: true,
            ..sample_server()
        };
        let manager = ServerManager::new(
            vec![active, paused],
            None,
            settings,
            fixture_geo(),
            None,
            &bootstrap,
            "development",
        );

        assert_eq!(manager.summary().await.tracked_servers, 1);
        let response = manager
            .servers_list_response(None, ServersListSortField::Players, SortOrder::Desc)
            .await;
        assert_eq!(response.servers.len(), 1);
        let admin = manager.admin_servers_list().await;
        assert_eq!(admin.servers.len(), 2);
        assert_eq!(admin.servers.iter().filter(|s| s.paused).count(), 1);
    }

    fn sample_server_with_id(id: Uuid) -> Server {
        Server {
            id,
            name: "Test".into(),
            host: "127.0.0.1".into(),
            port: Some(25565),
            platform: Platform::Pc,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            peak_players: None,
            peak_players_timestamp: None,
            paused: false,
        }
    }

    #[test]
    fn matches_server_search_filters_by_name_host_and_asn() {
        let mut server = TrackedServer::from_config(Server {
            id: Uuid::new_v4(),
            name: "Hypixel".into(),
            host: "mc.hypixel.net".into(),
            port: Some(25565),
            platform: Platform::Pc,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            peak_players: None,
            peak_players_timestamp: None,
            paused: false,
        });
        server.asn = AsnLookup {
            asn: "AS13335".into(),
            asn_org: "Cloudflare, Inc.".into(),
            cidr: None,
        };

        assert!(matches_server_search(&server, None));
        assert!(matches_server_search(&server, Some("hypixel")));
        assert!(matches_server_search(&server, Some("mc.hypixel")));
        assert!(matches_server_search(&server, Some("cloudflare")));
        assert!(matches_server_search(&server, Some("25565")));
        assert!(matches_server_search(&server, Some("PC")));
        assert!(!matches_server_search(&server, Some("mineplex")));
    }

    #[test]
    fn matches_server_search_is_loose_on_spacing_and_case() {
        let mut server = TrackedServer::from_config(Server {
            id: Uuid::new_v4(),
            name: "WildNetwork".into(),
            host: "play.wildnetwork.net".into(),
            port: Some(25565),
            platform: Platform::Pc,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            peak_players: None,
            peak_players_timestamp: None,
            paused: false,
        });
        server.asn = AsnLookup {
            asn: "AS1".into(),
            asn_org: "Wild Network Hosting".into(),
            cidr: None,
        };

        assert!(matches_server_search(&server, Some("wild network")));
        assert!(matches_server_search(&server, Some("wildnetwork")));
        assert!(matches_server_search(&server, Some("WILD NETWORK")));
        assert!(matches_server_search(&server, Some("wild network hosting")));
    }

    #[test]
    fn matches_asn_org_matches_org_label_not_server_name() {
        let mut server = TrackedServer::from_config(Server {
            id: Uuid::new_v4(),
            name: "DonutSMP".into(),
            host: "donutsmp.net".into(),
            port: Some(25565),
            platform: Platform::Pc,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            peak_players: None,
            peak_players_timestamp: None,
            paused: false,
        });
        server.asn = AsnLookup {
            asn: "AS99999".into(),
            asn_org: "DonutSMP Network".into(),
            cidr: None,
        };

        assert!(matches_asn_org(&server, "DonutSMP"));
        assert!(matches_asn_org(&server, "donut smp"));
        assert!(!matches_asn_org(&server, "donutsmp.net"));
    }

    #[test]
    fn matches_asn_search_is_loose_on_spacing_and_case() {
        let key = AsnAggregateKey {
            asn: "AS12345".into(),
            asn_org: "WildNetwork".into(),
        };
        assert!(matches_asn_search(&key, Some("wild network")));
        assert!(matches_asn_search(&key, Some("wildnetwork")));
        assert!(matches_asn_search(&key, Some("AS12345")));
    }

    #[tokio::test]
    async fn search_asns_response_counts_matching_org_servers() {
        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let bootstrap = settings.read().await.clone();
        let manager = ServerManager::new(
            vec![
                sample_server_with_id(Uuid::new_v4()),
                sample_server_with_id(Uuid::new_v4()),
            ],
            None,
            settings,
            fixture_geo(),
            None,
            &bootstrap,
            "development",
        );

        {
            let mut servers = manager.servers.write().await;
            servers[0].asn = AsnLookup {
                asn: "AS1".into(),
                asn_org: "DonutSMP".into(),
                cidr: None,
            };
            servers[0].players_online = Some(100);
            servers[1].asn = AsnLookup {
                asn: "AS2".into(),
                asn_org: "DonutSMP".into(),
                cidr: None,
            };
            servers[1].players_online = Some(50);
        }

        let response = manager.search_asns_response("DonutSMP", 25).await;
        let org_servers = &response.servers_with_asn_org;
        assert!(!response.org_servers_truncated);
        assert_eq!(org_servers.summary.tracked_servers, 2);
        assert_eq!(org_servers.summary.total_players, 150);
        assert_eq!(org_servers.servers.len(), 2);
    }

    #[tokio::test]
    async fn servers_list_response_sorts_by_players_online_desc() {
        let id_high = Uuid::new_v4();
        let id_mid = Uuid::new_v4();
        let id_low = Uuid::new_v4();
        let id_offline = Uuid::new_v4();

        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let bootstrap = settings.read().await.clone();
        let manager = ServerManager::new(
            vec![
                sample_server_with_id(id_low),
                sample_server_with_id(id_high),
                sample_server_with_id(id_offline),
                sample_server_with_id(id_mid),
            ],
            None,
            settings,
            fixture_geo(),
            None,
            &bootstrap,
            "development",
        );

        {
            let mut servers = manager.servers.write().await;
            servers[0].players_online = Some(5);
            servers[1].players_online = Some(100);
            servers[2].players_online = None;
            servers[3].players_online = Some(42);
        }

        let response = manager
            .servers_list_response(None, ServersListSortField::Players, SortOrder::Desc)
            .await;
        let ids: Vec<_> = response
            .servers
            .iter()
            .map(|server| server.id.parse::<Uuid>().unwrap())
            .collect();
        assert_eq!(ids, vec![id_high, id_mid, id_low, id_offline]);
    }

    #[tokio::test]
    async fn servers_list_response_sorts_by_name_asc() {
        let id_charlie = Uuid::new_v4();
        let id_alpha = Uuid::new_v4();
        let id_bravo = Uuid::new_v4();

        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let bootstrap = settings.read().await.clone();
        let manager = ServerManager::new(
            vec![
                Server {
                    id: id_charlie,
                    name: "Charlie".into(),
                    ..sample_server()
                },
                Server {
                    id: id_alpha,
                    name: "Alpha".into(),
                    ..sample_server()
                },
                Server {
                    id: id_bravo,
                    name: "Bravo".into(),
                    ..sample_server()
                },
            ],
            None,
            settings,
            fixture_geo(),
            None,
            &bootstrap,
            "development",
        );

        let response = manager
            .servers_list_response(None, ServersListSortField::Name, SortOrder::Asc)
            .await;
        let ids: Vec<_> = response
            .servers
            .iter()
            .map(|server| server.id.parse::<Uuid>().unwrap())
            .collect();
        assert_eq!(ids, vec![id_alpha, id_bravo, id_charlie]);
    }

    #[tokio::test]
    async fn asn_detail_response_returns_matching_servers() {
        let id_match_a = Uuid::new_v4();
        let id_match_b = Uuid::new_v4();
        let id_other = Uuid::new_v4();

        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let bootstrap = settings.read().await.clone();
        let manager = ServerManager::new(
            vec![
                sample_server_with_id(id_match_a),
                sample_server_with_id(id_match_b),
                sample_server_with_id(id_other),
            ],
            None,
            settings,
            fixture_geo(),
            None,
            &bootstrap,
            "development",
        );

        {
            let mut servers = manager.servers.write().await;
            for index in [0, 1] {
                servers[index].asn = AsnLookup {
                    asn: "AS13335".into(),
                    asn_org: "Cloudflare, Inc.".into(),
                    cidr: None,
                };
                servers[index].players_online = Some(if index == 0 { 100 } else { 42 });
            }
            servers[2].asn = AsnLookup {
                asn: "AS15169".into(),
                asn_org: "Google LLC".into(),
                cidr: None,
            };
            servers[2].players_online = Some(5);
        }

        let response = manager
            .asn_detail_response("AS13335", "Cloudflare, Inc.")
            .await
            .expect("asn detail");

        assert_eq!(response.asn, "AS13335");
        assert_eq!(response.asn_org, "Cloudflare, Inc.");
        assert_eq!(response.players_online, 142);
        assert_eq!(response.server_count, 2);
        assert_eq!(response.summary.total_players, 142);
        assert_eq!(response.summary.tracked_servers, 2);
        assert_eq!(response.servers.len(), 2);
        assert_eq!(response.servers[0].id, id_match_a.to_string());
        assert_eq!(response.servers[1].id, id_match_b.to_string());
        assert!(manager
            .asn_detail_response("AS99999", "Missing")
            .await
            .is_none());
    }

    #[tokio::test]
    async fn push_loop_exits_on_drain() {
        let settings = Arc::new(RwLock::new(AppSettings {
            metrics_push_cron: "0 0 * * * *".into(),
            ..Default::default()
        }));
        let bootstrap = settings.read().await.clone();
        let manager = Arc::new(ServerManager::new(
            vec![],
            None,
            settings,
            fixture_geo(),
            None,
            &bootstrap,
            "development",
        ));
        let push_loop = spawn_push_loop(manager);

        tokio::time::timeout(Duration::from_secs(5), push_loop.drain())
            .await
            .expect("push loop should drain promptly");
    }
}
