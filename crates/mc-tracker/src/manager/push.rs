use std::str::FromStr;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use cron::Schedule;
use futures::future::join_all;
use mc_db::db::repos::servers;
use mc_insights::PlayerCountEntry;
use tokio::sync::watch;
use tokio::task::JoinHandle;
use tracing::{info, warn};
use uuid::Uuid;

use super::ServerManager;

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
        let mut cron_expr = String::new();
        let mut schedule: Option<Schedule> = None;

        loop {
            let next_cron = manager
                .settings
                .cached_str(mc_settings::SettingKey::MetricsPushCron);
            if next_cron != cron_expr {
                cron_expr = next_cron;
                match Schedule::from_str(&cron_expr) {
                    Ok(parsed) => schedule = Some(parsed),
                    Err(err) => {
                        warn!(
                            error = %err,
                            cron = %cron_expr,
                            "invalid metrics push cron; retrying in 5s"
                        );
                        schedule = None;
                    }
                }
            }

            if *shutdown_rx.borrow() {
                break;
            }

            if schedule.is_some() {
                if let Err(err) = manager.run_push_cycle().await {
                    warn!(error = %err, "push cycle failed");
                }
            }

            if *shutdown_rx.borrow() {
                break;
            }

            let sleep = match &schedule {
                Some(schedule) => duration_until_next_cron_tick(schedule),
                None => Duration::from_secs(5),
            };

            tokio::select! {
                _ = tokio::time::sleep(sleep) => {},
                changed = shutdown_rx.changed() => {
                    if changed.is_err() || *shutdown_rx.borrow() {
                        break;
                    }
                }
            }
        }

        manager.drain_push_cycle().await;
    });

    PushLoopHandle {
        shutdown: shutdown_tx,
        task,
    }
}

fn duration_until_next_cron_tick(schedule: &Schedule) -> Duration {
    let now = Utc::now();
    let next = schedule
        .upcoming(Utc)
        .next()
        .expect("valid cron schedule has upcoming ticks");
    next.signed_duration_since(now)
        .to_std()
        .unwrap_or(Duration::ZERO)
        .max(Duration::from_millis(1))
}

impl ServerManager {
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

        struct Guard<'a>(&'a std::sync::atomic::AtomicBool);
        impl Drop for Guard<'_> {
            fn drop(&mut self) {
                self.0.store(false, Ordering::Release);
            }
        }
        let _guard = Guard(&self.pushing);

        let server_ids: Vec<Uuid> = self
            .servers
            .read()
            .await
            .iter()
            .filter(|server| server.is_tracking())
            .map(|server| server.config.id)
            .collect();

        let fetch_started = std::time::Instant::now();
        let ping_results = join_all(
            server_ids
                .into_iter()
                .map(|id| async move { (id, self.ping_server(id).await) }),
        )
        .await;
        let fetch_elapsed = fetch_started.elapsed();
        let online = ping_results
            .iter()
            .filter(|(_, result)| result.is_ok())
            .count();
        let offline = ping_results.len() - online;
        info!(
            total = ping_results.len(),
            online,
            offline,
            elapsed_ms = fetch_elapsed.as_millis(),
            "fetched all servers"
        );

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

        let mut entries = Vec::new();
        for server in self
            .servers
            .read()
            .await
            .iter()
            .filter(|server| server.is_tracking())
        {
            let Some(players_online) = server.players_online else {
                continue;
            };
            entries.push(PlayerCountEntry {
                id: server.config.id.to_string(),
                name: server.config.name.clone(),
                server_type: server.config.platform.as_str().to_string(),
                asn: server.asn.asn.clone(),
                asn_org: server.asn.asn_org.clone(),
                value: players_online as f64,
            });
        }

        self.insights.push_player_counts(&entries).await?;

        Ok(())
    }
}
