use std::collections::HashMap;
use std::sync::Mutex;

use crate::types::AsnLookup;

#[derive(Default)]
pub struct LookupCache {
    entries: Mutex<HashMap<String, AsnLookup>>,
}

impl LookupCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, ip: &str) -> Option<AsnLookup> {
        self.entries.lock().ok()?.get(ip).cloned()
    }

    pub fn insert(&self, ip: impl Into<String>, lookup: AsnLookup) {
        if let Ok(mut entries) = self.entries.lock() {
            entries.insert(ip.into(), lookup);
        }
    }

    pub fn len(&self) -> usize {
        self.entries.lock().map(|e| e.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_hit_avoids_repeat_inserts() {
        let cache = LookupCache::new();
        let lookup = AsnLookup {
            asn: "AS13335".into(),
            asn_org: "Cloudflare".into(),
            cidr: Some("1.1.1.0/24".into()),
        };
        cache.insert("1.1.1.1", lookup.clone());
        assert_eq!(cache.get("1.1.1.1"), Some(lookup));
        assert_eq!(cache.len(), 1);
    }
}
