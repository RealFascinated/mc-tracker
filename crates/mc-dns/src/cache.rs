use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum DnsRecordType {
    Srv,
    A,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct DnsCacheKey {
    hostname: String,
    record_type: DnsRecordType,
}

#[derive(Debug, Clone)]
enum CachedRecord {
    Srv(super::types::SrvRecord),
    A(String),
}

#[derive(Clone)]
pub struct DnsCache {
    ttl: Duration,
    entries: Arc<Mutex<HashMap<DnsCacheKey, (CachedRecord, Instant)>>>,
}

impl DnsCache {
    pub fn new(ttl: Duration) -> Self {
        Self {
            ttl,
            entries: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub(crate) fn get_srv(&self, hostname: &str) -> Option<super::types::SrvRecord> {
        self.get(hostname, DnsRecordType::Srv).and_then(|record| {
            if let CachedRecord::Srv(srv) = record {
                Some(srv)
            } else {
                None
            }
        })
    }

    pub(crate) fn get_a(&self, hostname: &str) -> Option<String> {
        self.get(hostname, DnsRecordType::A).and_then(|record| {
            if let CachedRecord::A(ip) = record {
                Some(ip)
            } else {
                None
            }
        })
    }

    fn get(&self, hostname: &str, record_type: DnsRecordType) -> Option<CachedRecord> {
        let key = DnsCacheKey {
            hostname: hostname.to_uppercase(),
            record_type,
        };
        let entries = self.entries.lock().ok()?;
        let (record, expires_at) = entries.get(&key)?;
        if Instant::now() >= *expires_at {
            return None;
        }
        Some(record.clone())
    }

    pub(crate) fn put_srv(&self, hostname: &str, record: super::types::SrvRecord) {
        self.put(
            hostname,
            DnsRecordType::Srv,
            CachedRecord::Srv(record),
        );
    }

    pub(crate) fn put_a(&self, hostname: &str, ip: String) {
        self.put(hostname, DnsRecordType::A, CachedRecord::A(ip));
    }

    fn put(&self, hostname: &str, record_type: DnsRecordType, record: CachedRecord) {
        let key = DnsCacheKey {
            hostname: hostname.to_uppercase(),
            record_type,
        };
        let expires_at = Instant::now() + self.ttl;
        if let Ok(mut entries) = self.entries.lock() {
            entries.insert(key, (record, expires_at));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_hit_and_expiry() {
        let cache = DnsCache::new(Duration::from_millis(1));
        cache.put_a("mc.example.com", "1.2.3.4".into());
        assert_eq!(cache.get_a("mc.example.com"), Some("1.2.3.4".into()));
        std::thread::sleep(Duration::from_millis(5));
        assert!(cache.get_a("mc.example.com").is_none());
    }

    #[test]
    fn cache_hit_avoids_second_lookup() {
        let cache = DnsCache::new(Duration::from_secs(60));
        cache.put_a("mc.example.com", "1.2.3.4".into());
        assert_eq!(cache.get_a("mc.example.com"), Some("1.2.3.4".into()));
        assert_eq!(cache.get_a("mc.example.com"), Some("1.2.3.4".into()));
    }
}
