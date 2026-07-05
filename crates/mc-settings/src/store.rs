use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use mc_db::db::repos::settings;
use mc_db::DbPool;
use serde_json::Value;
use tokio::sync::RwLock;

use crate::derived::LLM_API_KEY_MASK;
use crate::registry::{SettingKey, SettingSideEffects};

#[derive(Debug, thiserror::Error)]
pub enum SettingsError {
    #[error("{0}")]
    Validation(String),
    #[error("database error: {0}")]
    Database(#[from] mc_db::DbError),
}

#[derive(Debug, Clone)]
pub struct SettingItem {
    pub key: String,
    pub setting_type: String,
    pub value: Value,
    pub updated_at: Option<DateTime<Utc>>,
}

struct CachedEntry {
    value: Value,
    updated_at: Option<DateTime<Utc>>,
}

pub struct SettingsStore {
    pool: Option<DbPool>,
    cache: RwLock<HashMap<&'static str, CachedEntry>>,
    deployment_environment: String,
}

impl SettingsStore {
    pub async fn preload(
        pool: DbPool,
        deployment_environment: impl Into<String>,
    ) -> Result<Self, SettingsError> {
        let store = Self {
            pool: Some(pool.clone()),
            cache: RwLock::new(HashMap::new()),
            deployment_environment: deployment_environment.into(),
        };
        for key in SettingKey::ALL {
            store.refresh_cache_entry(key).await?;
        }
        Ok(store)
    }

    pub fn for_testing(deployment_environment: impl Into<String>) -> Arc<Self> {
        let mut cache = HashMap::new();
        for key in SettingKey::ALL {
            cache.insert(
                key.key(),
                CachedEntry {
                    value: key.default_value(),
                    updated_at: None,
                },
            );
        }
        Arc::new(Self {
            pool: None,
            cache: RwLock::new(cache),
            deployment_environment: deployment_environment.into(),
        })
    }

    pub fn for_testing_with(
        deployment_environment: impl Into<String>,
        overrides: &[(&'static str, Value)],
    ) -> Arc<Self> {
        let mut cache = HashMap::new();
        for key in SettingKey::ALL {
            cache.insert(
                key.key(),
                CachedEntry {
                    value: key.default_value(),
                    updated_at: None,
                },
            );
        }
        for (key, value) in overrides {
            cache.insert(
                key,
                CachedEntry {
                    value: value.clone(),
                    updated_at: None,
                },
            );
        }
        Arc::new(Self {
            pool: None,
            cache: RwLock::new(cache),
            deployment_environment: deployment_environment.into(),
        })
    }

    pub fn deployment_environment(&self) -> &str {
        &self.deployment_environment
    }

    pub fn pool(&self) -> Option<&DbPool> {
        self.pool.as_ref()
    }

    pub async fn get(&self, key: SettingKey) -> Value {
        let db_key = key.key();
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.get(db_key) {
                return entry.value.clone();
            }
        }
        self.refresh_cache_entry(key).await.ok();
        self.cache
            .read()
            .await
            .get(db_key)
            .map(|e| e.value.clone())
            .unwrap_or_else(|| key.default_value())
    }

    pub async fn get_bool(&self, key: SettingKey) -> bool {
        self.get(key).await.as_bool().unwrap_or(false)
    }

    pub async fn get_u32(&self, key: SettingKey) -> u32 {
        self.get(key).await.as_u64().unwrap_or(0) as u32
    }

    pub async fn get_u64(&self, key: SettingKey) -> u64 {
        self.get(key).await.as_u64().unwrap_or(0)
    }

    pub async fn get_str(&self, key: SettingKey) -> String {
        self.get(key).await.as_str().unwrap_or("").to_string()
    }

    pub async fn list_all(&self) -> Vec<SettingItem> {
        let mut items = Vec::with_capacity(SettingKey::ALL.len());
        for key in SettingKey::ALL {
            items.push(self.to_item(key).await);
        }
        items
    }

    pub async fn list_public(&self) -> Vec<SettingItem> {
        let mut items = Vec::new();
        for key in SettingKey::ALL {
            if key.is_public() {
                items.push(self.to_item(key).await);
            }
        }
        items
    }

    pub async fn update(&self, key_str: &str, value: Value) -> Result<SettingItem, SettingsError> {
        let key = SettingKey::from_key(key_str).map_err(SettingsError::Validation)?;
        key.type_()
            .validate(&value)
            .map_err(SettingsError::Validation)?;
        key.validate_cross(self, &value)
            .map_err(SettingsError::Validation)?;

        let stored = key
            .type_()
            .serialize_stored(&value)
            .map_err(SettingsError::Validation)?;
        let pool = self
            .pool
            .as_ref()
            .ok_or_else(|| SettingsError::Validation("settings store has no database".into()))?;
        settings::set(pool, key.key(), &stored).await?;

        let row = settings::get_row(pool, key.key()).await?;
        let updated_at = row.map(|(_, at)| at);
        {
            let mut cache = self.cache.write().await;
            cache.insert(
                key.key(),
                CachedEntry {
                    value: value.clone(),
                    updated_at,
                },
            );
        }

        Ok(self.to_item_with(key, value, updated_at).await)
    }

    pub fn side_effects_for(key: SettingKey) -> SettingSideEffects {
        key.side_effects()
    }

    async fn to_item(&self, key: SettingKey) -> SettingItem {
        let value = self.get(key).await;
        let updated_at = self
            .cache
            .read()
            .await
            .get(key.key())
            .and_then(|e| e.updated_at);
        self.to_item_with(key, value, updated_at).await
    }

    async fn to_item_with(
        &self,
        key: SettingKey,
        value: Value,
        updated_at: Option<DateTime<Utc>>,
    ) -> SettingItem {
        let display_value = if key.is_secret() {
            let configured = value.as_str().is_some_and(|s| !s.is_empty());
            if configured {
                Value::String(LLM_API_KEY_MASK.to_string())
            } else {
                Value::String(String::new())
            }
        } else {
            value
        };

        SettingItem {
            key: key.key().to_string(),
            setting_type: key.type_().name().to_string(),
            value: display_value,
            updated_at,
        }
    }

    async fn refresh_cache_entry(&self, key: SettingKey) -> Result<(), SettingsError> {
        let db_key = key.key();
        let row = match self.pool.as_ref() {
            Some(pool) => settings::get_row(pool, db_key).await?,
            None => None,
        };
        let (value, updated_at) = match row {
            Some((raw, at)) => (
                key.type_()
                    .parse_stored(&raw)
                    .unwrap_or_else(|_| key.default_value()),
                Some(at),
            ),
            None => (key.default_value(), None),
        };
        self.cache
            .write()
            .await
            .insert(db_key, CachedEntry { value, updated_at });
        Ok(())
    }
    pub fn cached_u32(&self, key: SettingKey) -> u32 {
        self.cache
            .try_read()
            .ok()
            .and_then(|cache| {
                cache
                    .get(key.key())
                    .and_then(|e| e.value.as_u64().map(|n| n as u32))
            })
            .unwrap_or_else(|| key.default_value().as_u64().unwrap_or(0) as u32)
    }

    pub fn cached_bool(&self, key: SettingKey) -> bool {
        self.cache
            .try_read()
            .ok()
            .and_then(|cache| cache.get(key.key()).and_then(|e| e.value.as_bool()))
            .unwrap_or_else(|| key.default_value().as_bool().unwrap_or(false))
    }

    pub fn cached_u64(&self, key: SettingKey) -> u64 {
        self.cache
            .try_read()
            .ok()
            .and_then(|cache| cache.get(key.key()).and_then(|e| e.value.as_u64()))
            .unwrap_or_else(|| key.default_value().as_u64().unwrap_or(0))
    }

    pub fn cached_str(&self, key: SettingKey) -> String {
        self.cache
            .try_read()
            .ok()
            .and_then(|cache| {
                cache
                    .get(key.key())
                    .and_then(|e| e.value.as_str().map(str::to_owned))
            })
            .unwrap_or_else(|| key.default_value().as_str().unwrap_or("").to_string())
    }

    pub fn cached_string_list(&self, key: SettingKey) -> Vec<String> {
        let cached = self
            .cache
            .try_read()
            .ok()
            .and_then(|cache| cache.get(key.key()).map(|entry| entry.value.clone()));
        if let Some(value) = cached {
            if let Some(items) = value.as_array() {
                let models: Vec<String> = items
                    .iter()
                    .filter_map(|item| item.as_str().map(str::to_owned))
                    .collect();
                if !models.is_empty() {
                    return models;
                }
            }
        }
        key.default_value()
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default()
    }
}

pub type SharedSettingsStore = Arc<SettingsStore>;
