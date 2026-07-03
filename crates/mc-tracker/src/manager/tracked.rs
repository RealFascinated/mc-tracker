use mc_db::model::Server;
use mc_geo::AsnLookup;
use mc_ping::Ping;

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
        }
    }

    pub(crate) fn clear_ping_state(&mut self) {
        self.players_online = None;
        self.last_ping_at = None;
    }

    pub(crate) fn is_tracking(&self) -> bool {
        !self.config.paused
    }

    pub(crate) fn apply_success(&mut self, ping: &Ping, asn: AsnLookup, resolved_ip: &str) -> bool {
        self.players_online = Some(ping.players.online);
        self.last_ping_at = Some(ping.timestamp);
        if let Some(favicon) = ping.favicon.as_ref() {
            self.favicon = Some(favicon.clone());
        }
        if asn != self.asn || self.last_asn_ip.as_deref() != Some(resolved_ip) {
            self.asn = asn;
            self.last_asn_ip = Some(resolved_ip.to_string());
        }
        self.record_peak_if_higher(ping.players.online, ping.timestamp)
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
