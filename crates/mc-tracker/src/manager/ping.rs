use mc_db::model::Platform;
use mc_db::AppSettings;
use mc_dns::{resolve_bedrock, resolve_java, DnsError};
use mc_geo::{AsnLookup, GeoError};
use mc_ping::{ping_bedrock, ping_java, with_retry, Ping, PingError};
use uuid::Uuid;

use super::ServerManager;

#[derive(Debug)]
pub(crate) enum PingServerError {
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

impl ServerManager {
    pub(crate) async fn ping_server(
        &self,
        id: Uuid,
        settings: &AppSettings,
    ) -> Result<(Ping, AsnLookup, String), PingServerError> {
        let server = self
            .get_tracked(id)
            .await
            .filter(|server| server.is_tracking())
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
}
