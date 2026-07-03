use std::borrow::Cow;

use async_trait::async_trait;
use hickory_resolver::config::ResolverConfig;
use hickory_resolver::name_server::TokioConnectionProvider;
use hickory_resolver::proto::rr::{RData, RecordType};
use hickory_resolver::Resolver;
use hickory_resolver::TokioResolver;

use crate::cache::DnsCache;
use crate::constants::SRV_QUERY_PREFIX;
use crate::error::DnsError;
use crate::types::SrvRecord;

#[async_trait]
pub trait DnsResolver: Send + Sync {
    async fn resolve_srv(&self, hostname: &str) -> Result<Option<SrvRecord>, DnsError>;
    async fn resolve_a(&self, hostname: &str) -> Result<Option<String>, DnsError>;
}

pub struct HickoryDnsResolver {
    resolver: TokioResolver,
    cache: Option<DnsCache>,
}

impl HickoryDnsResolver {
    pub fn new(cache: Option<DnsCache>) -> Self {
        Self {
            resolver: build_public_resolver().expect("system resolver config"),
            cache,
        }
    }
}

/// System nameservers without `search`/`domain` suffixes from resolv.conf.
///
/// Public Minecraft hostnames must not be looked up as e.g. `host.internal`.
fn build_public_resolver() -> Result<TokioResolver, hickory_resolver::ResolveError> {
    let (system_config, options) = hickory_resolver::system_conf::read_system_conf()?;
    let config = ResolverConfig::from_parts(None, vec![], system_config.name_servers().to_vec());
    Ok(
        Resolver::builder_with_config(config, TokioConnectionProvider::default())
            .with_options(options)
            .build(),
    )
}

fn as_fqdn(hostname: &str) -> Cow<'_, str> {
    if hostname.ends_with('.') {
        Cow::Borrowed(hostname)
    } else {
        Cow::Owned(format!("{hostname}."))
    }
}

async fn resolve_ip_system(hostname: &str) -> Result<Option<String>, DnsError> {
    let addrs: Vec<_> = tokio::net::lookup_host((hostname, 0))
        .await
        .map_err(|err| DnsError::query(hostname, err))?
        .collect();

    Ok(addrs
        .iter()
        .find(|addr| addr.is_ipv4())
        .or_else(|| addrs.first())
        .map(|addr| addr.ip().to_string()))
}

#[async_trait]
impl DnsResolver for HickoryDnsResolver {
    async fn resolve_srv(&self, hostname: &str) -> Result<Option<SrvRecord>, DnsError> {
        if let Some(cache) = &self.cache {
            if let Some(record) = cache.get_srv(hostname) {
                return Ok(Some(record));
            }
        }

        let query = format!("{SRV_QUERY_PREFIX}.{}", as_fqdn(hostname));
        let response = match self.resolver.lookup(query, RecordType::SRV).await {
            Ok(response) => response,
            Err(_) => return Ok(None),
        };

        let mut result = None;
        for rdata in response.iter() {
            if let RData::SRV(srv) = rdata {
                let target = srv.target().to_string();
                let target = target.strip_suffix('.').unwrap_or(&target).to_string();
                result = Some(SrvRecord {
                    target,
                    port: srv.port(),
                });
            }
        }

        if let (Some(cache), Some(record)) = (&self.cache, &result) {
            cache.put_srv(hostname, record.clone());
        }

        Ok(result)
    }

    async fn resolve_a(&self, hostname: &str) -> Result<Option<String>, DnsError> {
        if let Some(cache) = &self.cache {
            if let Some(ip) = cache.get_a(hostname) {
                return Ok(Some(ip));
            }
        }

        let fqdn = as_fqdn(hostname);
        let result = match self.resolver.lookup_ip(fqdn.as_ref()).await {
            Ok(response) => response.iter().next().map(|ip| ip.to_string()),
            Err(_) => resolve_ip_system(hostname).await?,
        };

        if result.is_none() {
            return resolve_ip_system(hostname).await;
        }

        if let (Some(cache), Some(ip)) = (&self.cache, &result) {
            cache.put_a(hostname, ip.clone());
        }

        Ok(result)
    }
}
