use crate::error::DnsError;
use crate::resolver::DnsResolver;
use crate::types::{ResolvedTarget, DEFAULT_BEDROCK_PORT, DEFAULT_JAVA_PORT};

/// Resolve hostname + port for Java ping (SRV rewrite, then A/AAAA record).
///
/// Matches the Minecraft client: SRV is only used when no port is explicitly set.
/// If the SRV target cannot be resolved, falls back to the original hostname.
pub async fn resolve_java(
    resolver: &dyn DnsResolver,
    hostname: &str,
    port: Option<u16>,
) -> Result<ResolvedTarget, DnsError> {
    let explicit_port = port;
    let mut host = hostname.to_string();
    let mut resolved_port = port.unwrap_or(DEFAULT_JAVA_PORT);
    let mut srv_applied = false;

    if explicit_port.is_none() {
        if let Some(srv) = resolver.resolve_srv(hostname).await? {
            host = srv.target;
            resolved_port = srv.port;
            srv_applied = true;
        }
    }

    match resolver.resolve_a(&host).await {
        Ok(Some(ip)) => Ok(ResolvedTarget {
            hostname: host,
            port: resolved_port,
            ip,
        }),
        Ok(None) if srv_applied => resolve_direct(resolver, hostname, explicit_port).await,
        Ok(None) => Err(DnsError::InvalidIp(host)),
        Err(_) if srv_applied => resolve_direct(resolver, hostname, explicit_port).await,
        Err(err) => Err(err),
    }
}

async fn resolve_direct(
    resolver: &dyn DnsResolver,
    hostname: &str,
    port: Option<u16>,
) -> Result<ResolvedTarget, DnsError> {
    let ip = resolver
        .resolve_a(hostname)
        .await?
        .ok_or_else(|| DnsError::InvalidIp(hostname.to_string()))?;

    Ok(ResolvedTarget {
        hostname: hostname.to_string(),
        port: port.unwrap_or(DEFAULT_JAVA_PORT),
        ip,
    })
}

/// Resolve hostname + port for Bedrock ping (A record only — no SRV).
pub async fn resolve_bedrock(
    resolver: &dyn DnsResolver,
    hostname: &str,
    port: Option<u16>,
) -> Result<ResolvedTarget, DnsError> {
    let resolved_port = port.unwrap_or(DEFAULT_BEDROCK_PORT);
    let ip = resolver
        .resolve_a(hostname)
        .await?
        .ok_or_else(|| DnsError::InvalidIp(hostname.to_string()))?;

    Ok(ResolvedTarget {
        hostname: hostname.to_string(),
        port: resolved_port,
        ip,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::SrvRecord;
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    struct MockResolver {
        srv: Option<SrvRecord>,
        a_records: HashMap<String, String>,
        srv_calls: Arc<AtomicU64>,
        a_calls: Arc<AtomicU64>,
    }

    #[async_trait]
    impl DnsResolver for MockResolver {
        async fn resolve_srv(&self, _hostname: &str) -> Result<Option<SrvRecord>, DnsError> {
            self.srv_calls.fetch_add(1, Ordering::SeqCst);
            Ok(self.srv.clone())
        }

        async fn resolve_a(&self, hostname: &str) -> Result<Option<String>, DnsError> {
            self.a_calls.fetch_add(1, Ordering::SeqCst);
            Ok(self.a_records.get(hostname).cloned())
        }
    }

    #[tokio::test]
    async fn srv_rewrite_changes_host_and_port() {
        let resolver = MockResolver {
            srv: Some(SrvRecord {
                target: "game.example.com".into(),
                port: 25566,
            }),
            a_records: HashMap::from([("game.example.com".into(), "203.0.113.10".into())]),
            srv_calls: Arc::new(AtomicU64::new(0)),
            a_calls: Arc::new(AtomicU64::new(0)),
        };

        let result = resolve_java(&resolver, "example.com", None).await.unwrap();
        assert_eq!(result.hostname, "game.example.com");
        assert_eq!(result.port, 25566);
        assert_eq!(result.ip, "203.0.113.10");
    }

    #[tokio::test]
    async fn explicit_port_skips_srv() {
        let resolver = MockResolver {
            srv: Some(SrvRecord {
                target: "game.example.com".into(),
                port: 25566,
            }),
            a_records: HashMap::from([("mc.example.com".into(), "198.51.100.1".into())]),
            srv_calls: Arc::new(AtomicU64::new(0)),
            a_calls: Arc::new(AtomicU64::new(0)),
        };

        let result = resolve_java(&resolver, "mc.example.com", Some(25570))
            .await
            .unwrap();
        assert_eq!(result.hostname, "mc.example.com");
        assert_eq!(result.port, 25570);
        assert_eq!(result.ip, "198.51.100.1");
        assert_eq!(resolver.srv_calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn srv_target_failure_falls_back_to_original_host() {
        struct FallbackResolver {
            a_records: HashMap<String, String>,
        }

        #[async_trait]
        impl DnsResolver for FallbackResolver {
            async fn resolve_srv(&self, _hostname: &str) -> Result<Option<SrvRecord>, DnsError> {
                Ok(Some(SrvRecord {
                    target: "bad_srv_target.example.com".into(),
                    port: 25566,
                }))
            }

            async fn resolve_a(&self, hostname: &str) -> Result<Option<String>, DnsError> {
                if hostname == "bad_srv_target.example.com" {
                    return Err(DnsError::query(
                        hostname,
                        "label contains invalid characters",
                    ));
                }
                Ok(self.a_records.get(hostname).cloned())
            }
        }

        let resolver = FallbackResolver {
            a_records: HashMap::from([("mc.example.com".into(), "198.51.100.1".into())]),
        };

        let result = resolve_java(&resolver, "mc.example.com", None)
            .await
            .unwrap();
        assert_eq!(result.hostname, "mc.example.com");
        assert_eq!(result.port, DEFAULT_JAVA_PORT);
        assert_eq!(result.ip, "198.51.100.1");
    }

    #[tokio::test]
    async fn java_default_port_when_none() {
        let resolver = MockResolver {
            srv: None,
            a_records: HashMap::from([("mc.example.com".into(), "198.51.100.1".into())]),
            srv_calls: Arc::new(AtomicU64::new(0)),
            a_calls: Arc::new(AtomicU64::new(0)),
        };

        let result = resolve_java(&resolver, "mc.example.com", None)
            .await
            .unwrap();
        assert_eq!(result.port, DEFAULT_JAVA_PORT);
    }

    #[tokio::test]
    async fn bedrock_default_port_when_none() {
        let resolver = MockResolver {
            srv: None,
            a_records: HashMap::from([("bedrock.example.com".into(), "203.0.113.20".into())]),
            srv_calls: Arc::new(AtomicU64::new(0)),
            a_calls: Arc::new(AtomicU64::new(0)),
        };

        let result = resolve_bedrock(&resolver, "bedrock.example.com", None)
            .await
            .unwrap();
        assert_eq!(result.port, DEFAULT_BEDROCK_PORT);
        assert_eq!(result.ip, "203.0.113.20");
        assert_eq!(resolver.srv_calls.load(Ordering::SeqCst), 0);
    }

    mod live_dns {
        use super::*;
        use crate::resolver::HickoryDnsResolver;

        #[tokio::test]
        #[ignore = "requires network"]
        async fn jartex_srv_target_with_underscores_resolves() {
            let resolver = HickoryDnsResolver::new(None);
            let result = resolve_java(&resolver, "play.jartexnetwork.com", None)
                .await
                .unwrap();
            assert_eq!(result.hostname, "play_jartexnetwork_com.jartex.fun");
            assert_eq!(result.port, 25565);
            assert!(!result.ip.is_empty());
        }

        #[tokio::test]
        #[ignore = "requires network"]
        async fn pika_srv_target_with_underscores_resolves() {
            let resolver = HickoryDnsResolver::new(None);
            let result = resolve_java(&resolver, "play.pika-network.net", None)
                .await
                .unwrap();
            assert_eq!(result.hostname, "play_pika-network_net.pika.host");
            assert_eq!(result.port, 25565);
            assert!(!result.ip.is_empty());
        }
    }
}

