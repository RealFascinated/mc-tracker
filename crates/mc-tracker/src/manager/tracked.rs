use std::collections::VecDeque;

use mc_api_types::ServerStatus;
use mc_db::model::Server;
use mc_geo::AsnLookup;
use mc_ping::Ping;

/// Tunables for rejecting implausible player counts, read from settings by
/// the push cycle and passed down per ping.
#[derive(Debug, Clone, Copy)]
pub(crate) struct OutlierRule {
    /// How many recent accepted counts form the baseline.
    pub window: usize,
    /// Counts above max(median * ratio, floor) and below median / ratio are
    /// rejected. Values below 2 disable the check.
    pub ratio: u32,
    /// Smallest upper bound the check may use, so a few-player server can
    /// grow tenfold without tripping it. Also the minimum baseline the
    /// collapse check applies to.
    pub floor: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct RejectedPing {
    pub online: u32,
    pub median: u64,
    pub samples: usize,
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
    /// Rolling window of recently accepted player counts, used as the
    /// baseline for outlier rejection. Survives offline periods on purpose:
    /// a server going down for a day must not reset its baseline.
    recent_counts: VecDeque<u32>,
}

impl TrackedServer {
    pub(crate) fn from_config(config: Server) -> Self {
        Self {
            peak_players: config.peak_players,
            peak_players_timestamp: config.peak_players_timestamp,
            config,
            players_online: None,
            last_ping_at: None,
            favicon: None,
            asn: AsnLookup::empty(),
            last_asn_ip: None,
            recent_counts: VecDeque::new(),
        }
    }

    pub(crate) fn clear_ping_state(&mut self) {
        self.players_online = None;
        self.last_ping_at = None;
    }

    pub(crate) fn is_tracking(&self) -> bool {
        !self.config.paused
    }

    /// Whether the last ping attempt succeeded. A tracked server with no
    /// successful ping yet is offline.
    pub(crate) fn status(&self) -> ServerStatus {
        if self.players_online.is_some() {
            ServerStatus::Online
        } else {
            ServerStatus::Offline
        }
    }

    /// Whether `online` is far enough from this server's recent baseline to
    /// be a fluke ping. Needs a full baseline window of accepted samples
    /// before it can reject anything, so a restart or a genuinely new server
    /// is never blocked by an empty or partial baseline.
    pub(crate) fn is_outlier(&self, online: u32, rule: &OutlierRule) -> bool {
        if rule.ratio < 2 || self.recent_counts.len() < rule.window {
            return false;
        }
        let Some(median) = self.baseline_median() else {
            return false;
        };
        let bound = median
            .saturating_mul(rule.ratio as u64)
            .max(u64::from(rule.floor));
        if u64::from(online) > bound {
            return true;
        }
        if median < u64::from(rule.floor) {
            return false;
        }
        u64::from(online) * u64::from(rule.ratio) < median
    }

    pub(crate) fn rejected_ping(&self, online: u32) -> RejectedPing {
        RejectedPing {
            online,
            median: self.baseline_median().unwrap_or(0),
            samples: self.recent_counts.len(),
        }
    }

    fn baseline_median(&self) -> Option<u64> {
        if self.recent_counts.is_empty() {
            return None;
        }
        let mut sorted: Vec<u32> = Vec::new();
        sorted.extend(self.recent_counts.iter().copied());
        sorted.sort_unstable();
        let mid = sorted.len() / 2;
        if sorted.len() % 2 == 1 {
            Some(u64::from(sorted[mid]))
        } else {
            Some((u64::from(sorted[mid - 1]) + u64::from(sorted[mid])) / 2)
        }
    }

    pub(crate) fn apply_success(
        &mut self,
        ping: &Ping,
        asn: AsnLookup,
        resolved_ip: &str,
        rule: &OutlierRule,
    ) -> bool {
        self.players_online = Some(ping.players.online);
        self.last_ping_at = Some(ping.timestamp);
        if let Some(favicon) = ping.favicon.as_ref() {
            self.favicon = Some(favicon.clone());
        }
        if asn != self.asn || self.last_asn_ip.as_deref() != Some(resolved_ip) {
            self.asn = asn;
            self.last_asn_ip = Some(resolved_ip.to_string());
        }
        self.remember_count(ping.players.online, rule.window);
        self.record_peak_if_higher(ping.players.online, ping.timestamp)
    }

    fn remember_count(&mut self, online: u32, window: usize) {
        if self.recent_counts.len() >= window {
            self.recent_counts.pop_front();
        }
        self.recent_counts.push_back(online);
    }

    fn record_peak_if_higher(&mut self, players: u32, at: i64) -> bool {
        let is_higher = self.peak_players.map(|peak| players > peak).unwrap_or(true);
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

pub(crate) fn accumulate_summary<'a>(
    servers: impl IntoIterator<Item = &'a TrackedServer>,
) -> ServerSummary {
    let mut summary = ServerSummary::default();
    for server in servers {
        summary.tracked_servers += 1;
        let Some(players) = server.players_online else {
            continue;
        };
        let players = players as u64;
        summary.total_players += players;
        match server.config.platform {
            mc_db::model::Platform::Pc => summary.players_pc += players,
            mc_db::model::Platform::Pe => summary.players_pe += players,
        }
    }
    summary
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use mc_db::model::{Platform, Server};
    use mc_ping::Players;
    use uuid::Uuid;

    fn rule() -> OutlierRule {
        OutlierRule {
            window: 5,
            ratio: 10,
            floor: 1000,
        }
    }

    fn tracked() -> TrackedServer {
        TrackedServer::from_config(Server {
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
        })
    }

    fn ping(online: u32) -> Ping {
        Ping {
            timestamp: Utc::now().timestamp_millis(),
            ip: "127.0.0.1".into(),
            players: Players {
                online,
                max: Some(100),
            },
            motd: None,
            version: None,
            favicon: None,
        }
    }

    fn feed(server: &mut TrackedServer, values: &[u32]) {
        let rule = rule();
        for online in values {
            server.remember_count(*online, rule.window);
        }
    }

    #[test]
    fn empty_baseline_never_rejects() {
        let server = tracked();
        assert!(!server.is_outlier(99_000_000, &rule()));
    }

    #[test]
    fn partial_baseline_never_rejects() {
        let mut server = tracked();
        feed(&mut server, &[10_000; 4]);
        assert!(!server.is_outlier(99_000_000, &rule()));
    }

    #[test]
    fn rejects_multi_million_spike_on_large_server() {
        let mut server = tracked();
        feed(&mut server, &[10_000; 5]);
        assert!(server.is_outlier(5_000_000, &rule()));
    }

    #[test]
    fn rejects_same_spike_on_tiny_server_via_ratio() {
        let mut server = tracked();
        feed(&mut server, &[5; 5]);
        assert!(server.is_outlier(5_000_000, &rule()));
    }

    #[test]
    fn small_server_growth_spikes_are_accepted() {
        let mut server = tracked();
        feed(&mut server, &[2, 4, 3, 5, 4]);
        assert!(!server.is_outlier(20, &rule()));
    }

    #[test]
    fn event_sized_jump_on_large_server_is_accepted() {
        let mut server = tracked();
        feed(&mut server, &[10_000; 5]);
        assert!(!server.is_outlier(80_000, &rule()));
    }

    #[test]
    fn rejects_collapse_to_one_player() {
        let mut server = tracked();
        feed(&mut server, &[5_000; 5]);
        assert!(server.is_outlier(1, &rule()));
    }

    #[test]
    fn ratio_below_two_disables_the_check() {
        let mut server = tracked();
        feed(&mut server, &[10_000; 5]);
        let off = OutlierRule { ratio: 0, ..rule() };
        assert!(!server.is_outlier(5_000_000, &off));
    }

    #[test]
    fn fake_ping_does_not_enter_baseline_or_state() {
        let mut server = tracked();
        feed(&mut server, &[10_000; 5]);
        let rule = rule();
        assert!(server.is_outlier(5_000_000, &rule));
        // A rejected ping never reaches apply_success, so the baseline keeps
        // its real samples and the reported median stays clean.
        let rejected = server.rejected_ping(5_000_000);
        assert_eq!(rejected.median, 10_000);
        assert_eq!(rejected.samples, 5);
        assert_eq!(rejected.online, 5_000_000);
    }

    #[test]
    fn accepted_ping_updates_state_and_shifts_baseline() {
        let mut server = tracked();
        let rule = rule();
        for online in [10_000u32, 10_010, 9_990, 10_005, 9_995] {
            server.apply_success(&ping(online), AsnLookup::empty(), "127.0.0.1", &rule);
        }
        assert_eq!(server.players_online, Some(9_995));
        assert_eq!(server.peak_players, Some(10_010));
        // The full window is now accepted, so the next wild ping is rejected.
        assert!(server.is_outlier(5_000_000, &rule));
        // And a sustained new normal is accepted once it fills the window.
        for _ in 0..5 {
            server.remember_count(40_000, rule.window);
        }
        assert!(!server.is_outlier(41_000, &rule));
    }

    #[test]
    fn window_drops_oldest_samples() {
        let mut server = tracked();
        feed(&mut server, &[10_000; 5]);
        server.remember_count(30_000, rule().window);
        assert_eq!(server.baseline_median(), Some(10_000));
        server.remember_count(30_000, rule().window);
        server.remember_count(30_000, rule().window);
        assert_eq!(server.baseline_median(), Some(30_000));
    }
}
