use async_trait::async_trait;
use hickory_resolver::TokioResolver;
use hickory_resolver::proto::rr::{RData, RecordType};

use crate::cache::DnsCache;
use crate::error::DnsError;
use crate::types::SrvRecord;

const SRV_QUERY_PREFIX: &str = "_minecraft._tcp";

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
            resolver: hickory_resolver::Resolver::builder_tokio()
                .expect("system resolver config")
                .build(),
            cache,
        }
    }
}

#[async_trait]
impl DnsResolver for HickoryDnsResolver {
    async fn resolve_srv(&self, hostname: &str) -> Result<Option<SrvRecord>, DnsError> {
        if let Some(cache) = &self.cache {
            if let Some(record) = cache.get_srv(hostname) {
                return Ok(Some(record));
            }
        }

        let query = format!("{SRV_QUERY_PREFIX}.{hostname}");
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

        let response = match self.resolver.lookup(hostname, RecordType::A).await {
            Ok(response) => response,
            Err(err) => return Err(DnsError::query(hostname, err)),
        };

        let mut result = None;
        for rdata in response.iter() {
            if let RData::A(a) = rdata {
                result = Some(a.0.to_string());
            }
        }

        if let (Some(cache), Some(ip)) = (&self.cache, &result) {
            cache.put_a(hostname, ip.clone());
        }

        Ok(result)
    }
}
