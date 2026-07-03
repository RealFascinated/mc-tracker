use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;

use chrono::Local;
use cron::Schedule;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::cache::LookupCache;
use crate::download::{database_file_path, ensure_database};
use crate::error::GeoError;
use crate::ip::is_non_public;
use crate::lookup::AsnDatabase;
use crate::types::{AsnLookup, GeoConfig, ASN_EDITION};

/// Daily ASN database refresh at 2:00 local time.
const ASN_REFRESH_CRON: &str = "0 0 2 * * *";

pub struct GeoService {
    config: GeoConfig,
    database: Arc<RwLock<Option<AsnDatabase>>>,
    cache: LookupCache,
}

impl GeoService {
    pub async fn initialize(config: GeoConfig) -> Result<Arc<Self>, GeoError> {
        if config.license_key.is_empty() {
            return Err(GeoError::MissingLicenseKey);
        }

        let database_dir = PathBuf::from(&config.database_dir);
        ensure_database(&database_dir, &config.license_key, true).await?;
        let service = Arc::new(Self {
            config,
            database: Arc::new(RwLock::new(None)),
            cache: LookupCache::new(),
        });
        service.reload_database().await?;
        Ok(service)
    }

    pub fn from_database_file(path: impl AsRef<Path>) -> Result<Self, GeoError> {
        let database = AsnDatabase::open(path)?;
        Ok(Self {
            config: GeoConfig {
                license_key: String::new(),
                database_dir: database
                    .path()
                    .parent()
                    .map(|p| p.to_string_lossy().into_owned())
                    .unwrap_or_else(|| ".".into()),
            },
            database: Arc::new(RwLock::new(Some(database))),
            cache: LookupCache::new(),
        })
    }

    pub fn is_ready(&self) -> bool {
        self.database
            .try_read()
            .ok()
            .and_then(|db| db.as_ref().map(|_| ()))
            .is_some()
    }

    pub fn database_path(&self) -> PathBuf {
        database_file_path(&self.config.database_dir)
    }

    pub async fn lookup_asn(&self, ip: &str) -> Result<AsnLookup, GeoError> {
        if let Some(cached) = self.cache.get(ip) {
            return Ok(cached);
        }

        let db = self.database.read().await;
        let Some(database) = db.as_ref() else {
            return Err(GeoError::DatabaseNotLoaded);
        };

        let lookup = database.lookup(ip)?;
        if lookup.is_empty() && ip.parse::<IpAddr>().is_ok_and(|addr| !is_non_public(addr)) {
            warn!(ip, "asn lookup returned empty for public ip");
        }
        self.cache.insert(ip, lookup.clone());
        Ok(lookup)
    }

    pub async fn refresh_if_stale(&self) -> Result<(), GeoError> {
        let database_dir = Path::new(&self.config.database_dir);
        let updated = ensure_database(database_dir, &self.config.license_key, true).await?;
        if updated {
            self.reload_database().await?;
            info!(edition = ASN_EDITION, "refreshed asn database");
        }
        Ok(())
    }

    async fn reload_database(&self) -> Result<(), GeoError> {
        let path = self.database_path();
        let database = AsnDatabase::open(&path)?;
        let mut guard = self.database.write().await;
        *guard = Some(database);
        self.cache.clear();
        Ok(())
    }

    pub fn spawn_refresh_scheduler(self: &Arc<Self>) {
        let service = Arc::clone(self);
        let schedule =
            Schedule::from_str(ASN_REFRESH_CRON).expect("hardcoded asn refresh cron is valid");
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(duration_until_next_cron_tick(&schedule)).await;
                if let Err(err) = service.refresh_if_stale().await {
                    warn!(error = %err, "scheduled asn database refresh failed");
                }
            }
        });
    }
}

fn duration_until_next_cron_tick(schedule: &Schedule) -> Duration {
    let now = Local::now();
    let next = schedule
        .upcoming(Local)
        .next()
        .expect("valid cron schedule has upcoming ticks");
    next.signed_duration_since(now)
        .to_std()
        .unwrap_or(Duration::ZERO)
        .max(Duration::from_millis(1))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/GeoLite2-ASN-Test.mmdb")
    }

    #[tokio::test]
    async fn lookup_uses_cache() {
        let service = GeoService::from_database_file(fixture_path()).unwrap();
        let first = service.lookup_asn("1.128.0.0").await.unwrap();
        assert_eq!(first.asn, "AS1221");
        assert_eq!(service.cache.len(), 1);

        let second = service.lookup_asn("1.128.0.0").await.unwrap();
        assert_eq!(second, first);
    }

    #[tokio::test]
    async fn from_database_file_is_ready() {
        let service = GeoService::from_database_file(fixture_path()).unwrap();
        assert!(service.is_ready());
    }

    #[tokio::test]
    async fn reload_database_clears_lookup_cache() {
        let temp = tempfile::tempdir().unwrap();
        let db_path = temp.path().join("GeoLite2-ASN.mmdb");
        std::fs::copy(fixture_path(), &db_path).unwrap();

        let service = GeoService::from_database_file(&db_path).unwrap();
        let _ = service.lookup_asn("1.128.0.0").await.unwrap();
        assert_eq!(service.cache.len(), 1);

        service.reload_database().await.unwrap();
        assert!(service.cache.is_empty());
    }
}
