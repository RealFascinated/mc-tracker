use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use mc_api_types::{
    AdminServerResponse, AdminServersListResponse, ServerListItemResponse,
    ServerTimeseriesResponse, ServersListResponse, ServersSummaryResponse,
};
use mc_db::model::{Platform, Server};
use mc_db::AppSettings;
use mc_geo::{AsnLookup, GeoError, GeoService};
use mc_metrics::{
    align_samples_to_window, peak_players_24h, peak_players_30d, player_count_series,
    MetricQueryWindow, MetricsError, PlayerCountEntry, PlayerCountRegistry, VmPushClient,
    VmQueryBuilder, VmQueryClient,
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
    pub asn: AsnLookup,
    pub last_asn_ip: Option<String>,
}

impl TrackedServer {
    fn from_config(config: Server) -> Self {
        Self {
            config,
            players_online: None,
            last_ping_at: None,
            asn: AsnLookup::empty(),
            last_asn_ip: None,
        }
    }

    fn clear_ping_state(&mut self) {
        self.players_online = None;
        self.last_ping_at = None;
    }

    fn apply_success(&mut self, ping: &Ping, asn: AsnLookup, resolved_ip: &str) {
        self.players_online = Some(ping.players.online);
        self.last_ping_at = Some(ping.timestamp);
        if asn.asn_org != self.asn.asn_org || self.last_asn_ip.as_deref() != Some(resolved_ip) {
            self.asn = asn;
            self.last_asn_ip = Some(resolved_ip.to_string());
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct ServerSummary {
    pub total_players: u64,
    pub players_pc: u64,
    pub players_pe: u64,
    pub tracked_servers: u32,
    pub last_updated: Option<i64>,
}

pub struct ServerManager {
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
        settings: Arc<RwLock<AppSettings>>,
        geo: Arc<GeoService>,
        vm_auth_token: Option<String>,
        bootstrap_settings: &AppSettings,
        metrics_environment: impl Into<String>,
    ) -> Self {
        let metrics_environment = metrics_environment.into();
        Self {
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

        server.config = config;
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
            summary.last_updated = match (summary.last_updated, server.last_ping_at) {
                (Some(current), Some(value)) => Some(current.max(value)),
                (None, Some(value)) => Some(value),
                (current, None) => current,
            };
        }

        summary
    }

    pub async fn servers_list_response(&self) -> ServersListResponse {
        let summary = self.summary().await;
        let peak_players24h = self.peak_players_24h().await;
        let peak_players30d = self.peak_players_30d().await;
        let servers = self
            .servers
            .read()
            .await
            .iter()
            .map(|server| ServerListItemResponse {
                id: server.config.id.to_string(),
                name: server.config.name.clone(),
                server_type: server.config.platform.as_str().to_string(),
                host: server.config.host.clone(),
                port: server.config.port,
                asn: server.asn.asn.clone(),
                asn_org: server.asn.asn_org.clone(),
                players_online: server.players_online,
            })
            .collect();

        ServersListResponse {
            summary: ServersSummaryResponse {
                total_players: summary.total_players,
                players_pc: summary.players_pc,
                players_pe: summary.players_pe,
                tracked_servers: summary.tracked_servers,
                last_updated: summary.last_updated,
                peak_players24h,
                peak_players30d,
            },
            servers,
        }
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

        let window = MetricQueryWindow::parse(from_epoch, to_epoch)?;
        let promql = player_count_series(self.environment(), &id.to_string());

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

        for id in server_ids {
            match self.ping_server(id, &settings).await {
                Ok((ping, asn, resolved_ip)) => {
                    let mut servers = self.servers.write().await;
                    if let Some(server) = servers.iter_mut().find(|s| s.config.id == id) {
                        server.apply_success(&ping, asn, &resolved_ip);
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

    async fn peak_players_30d(&self) -> Option<f64> {
        self.query_scalar(peak_players_30d).await
    }

    async fn query_scalar(&self, build_query: fn(&str) -> String) -> Option<f64> {
        let promql = build_query(self.environment());

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

fn dns_cache_for(settings: &AppSettings) -> Option<mc_ping::DnsCache> {
    settings.dns_cache_enabled.then(|| {
        mc_ping::DnsCache::new(Duration::from_secs(
            settings.dns_cache_ttl_minutes as u64 * 60,
        ))
    })
}

pub(crate) fn settings_response(settings: &AppSettings) -> mc_api_types::SettingsResponse {
    mc_api_types::SettingsResponse {
        api_port: settings.api_port,
        api_address: settings.api_address.clone(),
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
        }
    }

    #[tokio::test]
    async fn loads_servers_into_memory() {
        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let bootstrap = settings.read().await.clone();
        let manager = ServerManager::new(
            vec![sample_server(), sample_server()],
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
        }
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
