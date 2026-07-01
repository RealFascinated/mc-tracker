use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures::future::join_all;
use mc_api_types::{
    AdminServerResponse, AdminServersListResponse, AsnDetailResponse, AsnListItemResponse,
    AsnsListResponse, AsnsSummaryResponse, AsnTimeseriesResponse, EntityPeakStats,
    PeakPlayersRecord, PlayersPeakSummary, ServerListItemResponse, ServerSearchItemResponse,
    ServerTimeseriesResponse, ServersListResponse, ServersSearchResponse, ServersSummaryResponse,
};
use mc_db::model::{Platform, Server};
use mc_db::AppSettings;
use mc_geo::{AsnLookup, GeoError, GeoService};
use mc_db::db::repos::servers;
use mc_db::DbPool;
use mc_metrics::{
    align_samples_to_window, labels, peak_players_24h, peak_players_24h_by_asn,
    peak_players_24h_by_server, peak_players_7d, player_count_series,
    players_for_asn_series, total_players_series, MetricQueryWindow, MetricsError,
    PlayerCountEntry, PlayerCountRegistry, VmPushClient, VmQueryBuilder, VmQueryClient,
};
use mc_ping::{
    ping_bedrock, ping_java, resolve_bedrock, resolve_java, with_retry, DnsError, HickoryDnsResolver,
    Ping, PingError,
};
use tokio::sync::{watch, RwLock};
use tokio::task::JoinHandle;
use tokio::time::{interval, MissedTickBehavior};
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Debug)]
enum PingServerError {
    NotTracked,
    Dns(DnsError),
    Ping(PingError),
    Asn { ip: String, error: GeoError },
}

impl std::fmt::Display for PingServerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotTracked => write!(f, "server not found in tracker"),
            Self::Dns(err) => write!(f, "dns resolve failed: {err}"),
            Self::Ping(err) => write!(f, "{err}"),
            Self::Asn { ip, error } => write!(f, "asn lookup failed for {ip}: {error}"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct TrackedServer {
    pub config: Server,
    pub players_online: Option<u32>,
    pub last_ping_at: Option<i64>,
    pub favicon: Option<String>,
    pub asn: AsnLookup,
    pub last_asn_ip: Option<String>,
    pub peak_players: Option<u32>,
    pub peak_players_timestamp: Option<i64>,
}

impl TrackedServer {
    fn from_config(config: Server) -> Self {
        Self {
            peak_players: config.peak_players,
            peak_players_timestamp: config.peak_players_timestamp,
            config,
            players_online: None,
            last_ping_at: None,
            favicon: None,
            asn: AsnLookup::empty(),
            last_asn_ip: None,
        }
    }

    fn clear_ping_state(&mut self) {
        self.players_online = None;
        self.last_ping_at = None;
    }

    fn apply_success(&mut self, ping: &Ping, asn: AsnLookup, resolved_ip: &str) -> bool {
        self.players_online = Some(ping.players.online);
        self.last_ping_at = Some(ping.timestamp);
        if let Some(favicon) = ping.favicon.as_ref() {
            self.favicon = Some(favicon.clone());
        }
        if asn.asn_org != self.asn.asn_org || self.last_asn_ip.as_deref() != Some(resolved_ip) {
            self.asn = asn;
            self.last_asn_ip = Some(resolved_ip.to_string());
        }
        self.record_peak_if_higher(ping.players.online, ping.timestamp)
    }

    fn record_peak_if_higher(&mut self, players: u32, at: i64) -> bool {
        let is_higher = self
            .peak_players
            .map(|peak| players > peak)
            .unwrap_or(true);
        if is_higher {
            self.peak_players = Some(players);
            self.peak_players_timestamp = Some(at);
        }
        is_higher
    }
}

#[derive(Debug, Clone, Default)]
pub struct ServerSummary {
    pub total_players: u64,
    pub players_pc: u64,
    pub players_pe: u64,
    pub tracked_servers: u32,
}

fn matches_server_search(server: &TrackedServer, search: Option<&str>) -> bool {
    let Some(query) = search.map(str::trim).filter(|value| !value.is_empty()) else {
        return true;
    };

    let needle = query.to_ascii_lowercase();
    let fields = [
        server.config.name.as_str(),
        server.config.host.as_str(),
        server.config.platform.as_str(),
        server.asn.asn.as_str(),
        server.asn.asn_org.as_str(),
    ];

    fields
        .iter()
        .any(|field| field.to_ascii_lowercase().contains(&needle))
        || server
            .config
            .port
            .is_some_and(|port| port.to_string().contains(query))
}

fn server_search_relevance(server: &TrackedServer, query: &str) -> u8 {
    let needle = query.to_ascii_lowercase();
    let name = server.config.name.to_ascii_lowercase();
    let host = server.config.host.to_ascii_lowercase();

    if name.starts_with(&needle) {
        return 3;
    }
    if host.starts_with(&needle) {
        return 2;
    }
    1
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct AsnAggregateKey {
    asn: String,
    asn_org: String,
}

#[derive(Debug, Clone)]
struct AsnAggregate {
    key: AsnAggregateKey,
    players_online: u64,
    server_count: u32,
}

fn asn_key(server: &TrackedServer) -> AsnAggregateKey {
    AsnAggregateKey {
        asn: server.asn.asn.clone(),
        asn_org: server.asn.asn_org.clone(),
    }
}

fn matches_asn_key(server: &TrackedServer, asn: &str, asn_org: &str) -> bool {
    server.asn.asn == asn && server.asn.asn_org == asn_org
}

fn matches_asn_search(asn: &AsnAggregateKey, search: Option<&str>) -> bool {
    let Some(query) = search.map(str::trim).filter(|value| !value.is_empty()) else {
        return true;
    };

    let needle = query.to_ascii_lowercase();
    [asn.asn.as_str(), asn.asn_org.as_str()]
        .iter()
        .any(|field| field.to_ascii_lowercase().contains(&needle))
}

pub struct ServerManager {
    pool: Option<DbPool>,
    servers: RwLock<Vec<TrackedServer>>,
    settings: Arc<RwLock<AppSettings>>,
    metrics_environment: String,
    dns: RwLock<HickoryDnsResolver>,
    geo: Arc<GeoService>,
    metrics: RwLock<PlayerCountRegistry>,
    push_client: RwLock<VmPushClient>,
    query_client: RwLock<VmQueryClient>,
    vm_auth_token: Option<String>,
    pushing: AtomicBool,
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

        server.config = config.clone();
        server.peak_players = config.peak_players;
        server.peak_players_timestamp = config.peak_players_timestamp;
        if identity_changed {
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
        let mut summary = ServerSummary {
            tracked_servers: servers.len() as u32,
            ..Default::default()
        };

        for server in servers.iter() {
            let Some(players) = server.players_online else {
                continue;
            };
            let players = players as u64;
            summary.total_players += players;
            match server.config.platform {
                Platform::Pc => summary.players_pc += players,
                Platform::Pe => summary.players_pe += players,
            }
        }

        summary
    }

    pub async fn servers_list_response(
        &self,
        search: Option<&str>,
    ) -> ServersListResponse {
        let summary = self.summary().await;
        let all_tracked = self.servers.read().await.clone();
        let tracked = all_tracked
            .iter()
            .filter(|server| matches_server_search(server, search))
            .cloned()
            .collect::<Vec<_>>();

        let environment = self.environment();
        let (peak_players24h, peak_players_7d, peaks_24h) = tokio::join!(
            self.peak_players_24h(),
            self.peak_players_7d(),
            self.peaks_24h_by_server_id(environment),
        );

        let mut servers = Vec::with_capacity(tracked.len());
        for server in tracked {
            let id = server.config.id.to_string();
            servers.push(ServerListItemResponse {
                id: id.clone(),
                name: server.config.name.clone(),
                server_type: server.config.platform.as_str().to_string(),
                host: server.config.host.clone(),
                port: server.config.port,
                asn: server.asn.asn.clone(),
                asn_org: server.asn.asn_org.clone(),
                players_online: server.players_online,
                favicon: server.favicon.clone(),
                peaks: entity_peak_stats(peaks_24h.get(&id).copied(), &server),
            });
        }

        servers.sort_by(|left, right| {
            let left_players = left.players_online.map(i64::from).unwrap_or(-1);
            let right_players = right.players_online.map(i64::from).unwrap_or(-1);
            right_players.cmp(&left_players)
        });

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

    pub async fn server_detail_response(&self, id: Uuid) -> Option<ServerListItemResponse> {
        let server = self.get_tracked(id).await?;
        let environment = self.environment();
        let id_str = id.to_string();
        let peaks_24h = self.peaks_24h_by_server_id(environment).await;

        Some(ServerListItemResponse {
            id: id_str.clone(),
            name: server.config.name.clone(),
            server_type: server.config.platform.as_str().to_string(),
            host: server.config.host.clone(),
            port: server.config.port,
            asn: server.asn.asn.clone(),
            asn_org: server.asn.asn_org.clone(),
            players_online: server.players_online,
            favicon: server.favicon.clone(),
            peaks: entity_peak_stats(peaks_24h.get(&id_str).copied(), &server),
        })
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

        const MAX_LIMIT: u32 = 25;
        let limit = limit.clamp(1, MAX_LIMIT) as usize;
        let servers = self.servers.read().await;

        let mut matches: Vec<_> = servers
            .iter()
            .filter(|server| matches_server_search(server, Some(query)))
            .collect();

        matches.sort_by(|left, right| {
            let left_score = server_search_relevance(left, query);
            let right_score = server_search_relevance(right, query);
            right_score
                .cmp(&left_score)
                .then_with(|| {
                    let left_players = left.players_online.map(i64::from).unwrap_or(-1);
                    let right_players = right.players_online.map(i64::from).unwrap_or(-1);
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
        for server in tracked {
            let key = asn_key(&server);
            if !matches_asn_search(&key, search) {
                continue;
            }

            let entry = aggregates.entry(key.clone()).or_insert_with(|| AsnAggregate {
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
            self.peak_players_24h(),
            self.peak_players_7d(),
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

    pub async fn asn_detail_response(
        &self,
        asn: &str,
        asn_org: &str,
    ) -> Option<AsnDetailResponse> {
        let all_tracked = self.servers.read().await.clone();
        let tracked: Vec<_> = all_tracked
            .iter()
            .filter(|server| matches_asn_key(server, asn, asn_org))
            .cloned()
            .collect();

        if tracked.is_empty() {
            return None;
        }

        let mut summary = ServerSummary::default();
        for server in &tracked {
            summary.tracked_servers += 1;
            let Some(players) = server.players_online else {
                continue;
            };
            let players = players as u64;
            summary.total_players += players;
            match server.config.platform {
                Platform::Pc => summary.players_pc += players,
                Platform::Pe => summary.players_pe += players,
            }
        }

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
        let entity_peaks = entity_peak_stats_with_all_time(
            asn_peak_24h,
            asn_peak_all_time(&all_tracked, &key),
        );

        let mut servers = Vec::with_capacity(tracked.len());
        for server in tracked {
            let id = server.config.id.to_string();
            servers.push(ServerListItemResponse {
                id: id.clone(),
                name: server.config.name.clone(),
                server_type: server.config.platform.as_str().to_string(),
                host: server.config.host.clone(),
                port: server.config.port,
                asn: server.asn.asn.clone(),
                asn_org: server.asn.asn_org.clone(),
                players_online: server.players_online,
                favicon: server.favicon.clone(),
                peaks: entity_peak_stats(peaks_24h_by_server.get(&id).copied(), &server),
            });
        }

        servers.sort_by(|left, right| {
            let left_players = left.players_online.map(i64::from).unwrap_or(-1);
            let right_players = right.players_online.map(i64::from).unwrap_or(-1);
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

    pub async fn asn_timeseries(
        &self,
        asn: &str,
        asn_org: &str,
        from_epoch: i64,
        to_epoch: i64,
    ) -> Result<AsnTimeseriesResponse, MetricsError> {
        if !self.asn_is_tracked(asn, asn_org).await {
            return Err(MetricsError::InvalidWindow("asn not found".into()));
        }

        let window = MetricQueryWindow::parse(from_epoch, to_epoch)?;
        let promql = players_for_asn_series(self.environment(), asn, asn_org);
        let samples = self.query_player_count_series(&window, &promql).await?;
        let (timestamps, players_online) = align_samples_to_window(&window, &samples);

        Ok(AsnTimeseriesResponse {
            asn: asn.to_string(),
            asn_org: asn_org.to_string(),
            from: window.from_epoch(),
            to: window.to_epoch(),
            step: window.step_seconds(),
            timestamps,
            players_online,
        })
    }

    pub async fn server_timeseries(
        &self,
        id: Uuid,
        from_epoch: i64,
        to_epoch: i64,
    ) -> Result<ServerTimeseriesResponse, MetricsError> {
        if self.get_tracked(id).await.is_none() {
            return Err(MetricsError::InvalidWindow("server not found".into()));
        }

        self.timeseries_response(&id.to_string(), from_epoch, to_epoch, |environment, _| {
            player_count_series(environment, &id.to_string())
        })
        .await
    }

    pub async fn total_timeseries(
        &self,
        from_epoch: i64,
        to_epoch: i64,
    ) -> Result<ServerTimeseriesResponse, MetricsError> {
        self.timeseries_response("total", from_epoch, to_epoch, |environment, _| {
            total_players_series(environment)
        })
        .await
    }

    async fn timeseries_response(
        &self,
        id: &str,
        from_epoch: i64,
        to_epoch: i64,
        build_promql: impl FnOnce(&str, &str) -> String,
    ) -> Result<ServerTimeseriesResponse, MetricsError> {
        let window = MetricQueryWindow::parse(from_epoch, to_epoch)?;
        let promql = build_promql(self.environment(), id);

        let samples = self.query_player_count_series(&window, &promql).await?;
        let (timestamps, players_online) = align_samples_to_window(&window, &samples);

        Ok(ServerTimeseriesResponse {
            id: id.to_string(),
            from: window.from_epoch(),
            to: window.to_epoch(),
            step: window.step_seconds(),
            timestamps,
            players_online,
        })
    }

    async fn query_player_count_series(
        &self,
        window: &MetricQueryWindow,
        promql: &str,
    ) -> Result<Vec<(i64, Option<f64>)>, MetricsError> {
        let query = VmQueryBuilder::default()
            .query(promql)
            .from(window.from())
            .to(window.to())
            .step(window.step())
            .build()?;

        let client = self.query_client.read().await;
        let response = client.execute(&query).await?;
        drop(client);

        Ok(VmQueryClient::matrix_samples(&response))
    }

    pub async fn drain_push_cycle(&self) {
        while self.pushing.load(Ordering::Acquire) {
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    }

    pub async fn run_push_cycle(&self) -> Result<(), anyhow::Error> {
        if self
            .pushing
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed)
            .is_err()
        {
            info!("skipping push cycle because a previous cycle is still running");
            return Ok(());
        }

        struct Guard<'a>(&'a AtomicBool);
        impl Drop for Guard<'_> {
            fn drop(&mut self) {
                self.0.store(false, Ordering::Release);
            }
        }
        let _guard = Guard(&self.pushing);

        let settings = self.settings.read().await.clone();
        let server_ids: Vec<Uuid> = self
            .servers
            .read()
            .await
            .iter()
            .map(|server| server.config.id)
            .collect();

        let ping_results = join_all(server_ids.into_iter().map(|id| {
            let settings = settings.clone();
            async move { (id, self.ping_server(id, &settings).await) }
        }))
        .await;

        for (id, result) in ping_results {
            match result {
                Ok((ping, asn, resolved_ip)) => {
                    let mut peak_update = None;
                    let mut servers = self.servers.write().await;
                    if let Some(server) = servers.iter_mut().find(|s| s.config.id == id) {
                        if server.apply_success(&ping, asn, &resolved_ip) {
                            peak_update = Some((ping.players.online, ping.timestamp));
                        }
                    }
                    drop(servers);
                    if let Some((players, at)) = peak_update {
                        if let Some(pool) = &self.pool {
                            if let Err(err) =
                                servers::update_peak_if_higher(pool, id, players, at).await
                            {
                                warn!(
                                    server_id = %id,
                                    error = %err,
                                    "failed to persist all-time player peak"
                                );
                            }
                        }
                    }
                }
                Err(err) => {
                    let mut servers = self.servers.write().await;
                    if let Some(server) = servers.iter_mut().find(|s| s.config.id == id) {
                        warn!(
                            server_id = %id,
                            server = %server.config.name,
                            host = %server.config.host,
                            platform = %server.config.platform.as_str(),
                            error = %err,
                            "server could not be pinged"
                        );
                        server.clear_ping_state();
                    }
                }
            }
        }

        let mut metrics = self.metrics.write().await;
        metrics.reset();
        for server in self.servers.read().await.iter() {
            let Some(players_online) = server.players_online else {
                continue;
            };
            metrics.set(PlayerCountEntry {
                id: server.config.id.to_string(),
                name: server.config.name.clone(),
                server_type: server.config.platform.as_str().to_string(),
                asn: server.asn.asn.clone(),
                asn_org: server.asn.asn_org.clone(),
                value: players_online as f64,
            });
        }
        let body = metrics.encode();
        drop(metrics);

        let client = self.push_client.read().await;
        client.push(&body).await?;

        Ok(())
    }

    async fn refresh_vm_clients(&self, settings: &AppSettings) {
        *self.push_client.write().await = VmPushClient::new(
            settings.victoriametrics_import_url(),
            self.vm_auth_token.clone(),
        );
        *self.query_client.write().await = VmQueryClient::new(
            settings.victoriametrics_base_url(),
            self.vm_auth_token.clone(),
        );
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

    async fn ping_server(
        &self,
        id: Uuid,
        settings: &AppSettings,
    ) -> Result<(Ping, AsnLookup, String), PingServerError> {
        let server = self
            .get_tracked(id)
            .await
            .ok_or(PingServerError::NotTracked)?;

        let port = server.config.port.map(|value| value as u16);

        let resolved = {
            let dns = self.dns.read().await;
            match server.config.platform {
                Platform::Pc => resolve_java(&*dns, &server.config.host, port)
                    .await
                    .map_err(PingServerError::Dns)?,
                Platform::Pe => resolve_bedrock(&*dns, &server.config.host, port)
                    .await
                    .map_err(PingServerError::Dns)?,
            }
        };

        let hostname = resolved.hostname.clone();
        let ip = resolved.ip.clone();
        let port = resolved.port;
        let timeout_ms = settings.pinger_timeout_ms;
        let attempts = settings.pinger_retry_attempts;
        let delay_ms = settings.pinger_retry_delay_ms;

        let ping = match server.config.platform {
            Platform::Pc => with_retry(attempts, delay_ms, &hostname, || {
                ping_java(&hostname, &ip, port, timeout_ms)
            })
            .await
            .map_err(PingServerError::Ping)?,
            Platform::Pe => with_retry(attempts, delay_ms, &hostname, || {
                ping_bedrock(&hostname, &ip, port, timeout_ms)
            })
            .await
            .map_err(PingServerError::Ping)?,
        };

        let asn = self
            .geo
            .lookup_asn(&ip)
            .await
            .map_err(|error| PingServerError::Asn {
                ip: ip.clone(),
                error,
            })?;
        Ok((ping, asn, ip))
    }

    async fn peak_players_24h(&self) -> Option<f64> {
        self.query_scalar(peak_players_24h).await
    }

    async fn peak_players_7d(&self) -> Option<f64> {
        self.query_scalar(peak_players_7d).await
    }

    async fn peaks_24h_by_server_id(&self, environment: &str) -> BTreeMap<String, f64> {
        let mut peaks: BTreeMap<String, f64> = BTreeMap::new();
        for entry in self
            .query_labeled_instant(peak_players_24h_by_server(environment))
            .await
        {
            let Some(id) = label_value(&entry.labels, labels::ID) else {
                continue;
            };
            peaks
                .entry(id)
                .and_modify(|current| *current = current.max(entry.value))
                .or_insert(entry.value);
        }
        peaks
    }

    async fn peaks_24h_by_asn_key(&self, environment: &str) -> BTreeMap<AsnAggregateKey, f64> {
        let mut peaks: BTreeMap<AsnAggregateKey, f64> = BTreeMap::new();
        for entry in self
            .query_labeled_instant(peak_players_24h_by_asn(environment))
            .await
        {
            let Some(key) = asn_key_from_labels(&entry.labels) else {
                continue;
            };
            peaks
                .entry(key)
                .and_modify(|current| *current = current.max(entry.value))
                .or_insert(entry.value);
        }
        peaks
    }

    async fn asn_is_tracked(&self, asn: &str, asn_org: &str) -> bool {
        self.servers
            .read()
            .await
            .iter()
            .any(|server| server.asn.asn == asn && server.asn.asn_org == asn_org)
    }

    async fn query_labeled_instant(
        &self,
        promql: String,
    ) -> Vec<mc_metrics::LabeledInstantValue> {
        let query = match VmQueryBuilder::default().query(promql).build() {
            Ok(query) => query,
            Err(err) => {
                warn!(error = %err, "metrics labeled instant query build failed");
                return Vec::new();
            }
        };
        let client = self.query_client.read().await;
        let response = match client.execute(&query).await {
            Ok(response) => response,
            Err(err) => {
                warn!(error = %err, "metrics labeled instant query execute failed");
                return Vec::new();
            }
        };
        VmQueryClient::labeled_instant_values(&response)
    }

    async fn query_scalar(&self, build_query: fn(&str) -> String) -> Option<f64> {
        self.query_scalar_promql(build_query(self.environment()))
            .await
    }

    async fn query_scalar_promql(&self, promql: String) -> Option<f64> {
        let query = match VmQueryBuilder::default().query(promql).build() {
            Ok(query) => query,
            Err(err) => {
                warn!(error = %err, "metrics scalar query build failed");
                return None;
            }
        };
        let client = self.query_client.read().await;
        let response = match client.execute(&query).await {
            Ok(response) => response,
            Err(err) => {
                warn!(error = %err, "metrics scalar query execute failed");
                return None;
            }
        };
        VmQueryClient::scalar_value(&response)
    }
}

fn label_value(
    labels: &serde_json::Map<String, serde_json::Value>,
    key: &str,
) -> Option<String> {
    labels.get(key).and_then(|value| value.as_str()).map(str::to_owned)
}

fn asn_key_from_labels(
    labels: &serde_json::Map<String, serde_json::Value>,
) -> Option<AsnAggregateKey> {
    Some(AsnAggregateKey {
        asn: label_value(labels, labels::ASN)?,
        asn_org: label_value(labels, labels::ASN_ORG).unwrap_or_default(),
    })
}

fn peak_players_record(
    players: Option<u32>,
    timestamp: Option<i64>,
) -> Option<PeakPlayersRecord> {
    Some(PeakPlayersRecord {
        players: players?,
        timestamp: timestamp?,
    })
}

fn entity_peak_stats(
    players_24h: Option<f64>,
    server: &TrackedServer,
) -> EntityPeakStats {
    entity_peak_stats_with_all_time(
        players_24h,
        peak_players_record(server.peak_players, server.peak_players_timestamp),
    )
}

fn entity_peak_stats_with_all_time(
    players_24h: Option<f64>,
    all_time: Option<PeakPlayersRecord>,
) -> EntityPeakStats {
    EntityPeakStats {
        players_24h,
        all_time,
    }
}

fn asn_peak_all_time(
    servers: &[TrackedServer],
    key: &AsnAggregateKey,
) -> Option<PeakPlayersRecord> {
    servers
        .iter()
        .filter(|server| asn_key(server) == *key)
        .filter_map(|server| {
            peak_players_record(server.peak_players, server.peak_players_timestamp)
        })
        .max_by_key(|peak| peak.players)
}

fn dns_cache_for(settings: &AppSettings) -> Option<mc_ping::DnsCache> {
    settings.dns_cache_enabled.then(|| {
        mc_ping::DnsCache::new(Duration::from_secs(
            settings.dns_cache_ttl_minutes as u64 * 60,
        ))
    })
}

pub(crate) fn settings_response(settings: &AppSettings) -> mc_api_types::SettingsResponse {
    mc_api_types::SettingsResponse {
        pinger_timeout_ms: settings.pinger_timeout_ms,
        pinger_retry_attempts: settings.pinger_retry_attempts,
        pinger_retry_delay_ms: settings.pinger_retry_delay_ms,
        dns_cache_enabled: settings.dns_cache_enabled,
        dns_cache_ttl_minutes: settings.dns_cache_ttl_minutes,
        victoriametrics_url: settings.victoriametrics_url.clone(),
        metrics_push_interval_seconds: settings.metrics_push_interval_seconds,
        sign_up_enabled: settings.sign_up_enabled,
        www_origin: settings.www_origin.clone(),
    }
}

pub(crate) fn admin_server_response(server: &Server) -> AdminServerResponse {
    AdminServerResponse {
        id: server.id.to_string(),
        name: server.name.clone(),
        server_type: server.platform.as_str().to_string(),
        host: server.host.clone(),
        port: server.port,
        created_at: server.created_at.to_rfc3339(),
        updated_at: server.updated_at.to_rfc3339(),
    }
}

pub struct PushLoopHandle {
    shutdown: watch::Sender<bool>,
    task: JoinHandle<()>,
}

impl PushLoopHandle {
    pub async fn drain(self) {
        let _ = self.shutdown.send(true);
        let _ = self.task.await;
    }
}

pub fn spawn_push_loop(manager: Arc<ServerManager>) -> PushLoopHandle {
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    let task = tokio::spawn(async move {
        let mut shutdown_rx = shutdown_rx;
        let mut interval_secs = 1u64;
        let mut ticker = interval(Duration::from_secs(interval_secs));
        ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                _ = ticker.tick() => {},
                changed = shutdown_rx.changed() => {
                    if changed.is_err() || *shutdown_rx.borrow() {
                        break;
                    }
                }
            }

            if *shutdown_rx.borrow() {
                break;
            }

            let next_secs = manager
                .settings
                .read()
                .await
                .metrics_push_interval_seconds
                .max(1);
            if next_secs != interval_secs {
                interval_secs = next_secs;
                ticker = interval(Duration::from_secs(interval_secs));
                ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
            }

            if let Err(err) = manager.run_push_cycle().await {
                warn!(error = %err, "push cycle failed");
            }
        }

        manager.drain_push_cycle().await;
    });

    PushLoopHandle {
        shutdown: shutdown_tx,
        task,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use mc_common::now_ms;
    use mc_db::model::Platform;
    use std::path::PathBuf;

    fn fixture_geo() -> Arc<GeoService> {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../mc-geo/tests/fixtures/GeoLite2-ASN-Test.mmdb");
        Arc::new(GeoService::from_database_file(path).unwrap())
    }

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

        let response = manager.servers_list_response(None).await;
        let ids: Vec<_> = response
            .servers
            .iter()
            .map(|server| server.id.parse::<Uuid>().unwrap())
            .collect();
        assert_eq!(ids, vec![id_high, id_mid, id_low, id_offline]);
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
        assert!(manager.asn_detail_response("AS99999", "Missing").await.is_none());
    }

    #[tokio::test]
    async fn push_loop_exits_on_drain() {
        let settings = Arc::new(RwLock::new(AppSettings {
            metrics_push_interval_seconds: 3600,
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
