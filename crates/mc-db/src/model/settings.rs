use serde::{Deserialize, Serialize};

use super::settings_constants::{
    self, DNS_CACHE_ENABLED, DNS_CACHE_TTL_MINUTES, METRICS_PUSH_CRON, PINGER_RETRY_ATTEMPTS,
    PINGER_RETRY_DELAY_MS, PINGER_TIMEOUT_MS, SIGN_UP_ENABLED, VICTORIAMETRICS_URL,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppSettings {
    pub pinger_timeout_ms: u64,
    pub pinger_retry_attempts: u32,
    pub pinger_retry_delay_ms: u64,
    pub dns_cache_enabled: bool,
    pub dns_cache_ttl_minutes: u32,
    /// VictoriaMetrics base URL (push + query paths are derived in code).
    pub victoriametrics_url: String,
    /// Six-field cron (seconds included), e.g. `*/15 * * * * *` for every 15 seconds.
    pub metrics_push_cron: String,
    pub sign_up_enabled: bool,
    /// Public www UI origin for CORS (e.g. https://tracker.example.com).
    pub www_origin: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            pinger_timeout_ms: PINGER_TIMEOUT_MS,
            pinger_retry_attempts: PINGER_RETRY_ATTEMPTS,
            pinger_retry_delay_ms: PINGER_RETRY_DELAY_MS,
            dns_cache_enabled: DNS_CACHE_ENABLED,
            dns_cache_ttl_minutes: DNS_CACHE_TTL_MINUTES,
            victoriametrics_url: VICTORIAMETRICS_URL.to_string(),
            metrics_push_cron: METRICS_PUSH_CRON.to_string(),
            sign_up_enabled: SIGN_UP_ENABLED,
            www_origin: String::new(),
        }
    }
}

impl AppSettings {
    pub fn victoriametrics_base_url(&self) -> &str {
        self.victoriametrics_url.trim_end_matches('/')
    }

    pub fn victoriametrics_import_url(&self) -> String {
        format!(
            "{}/api/v1/import/prometheus",
            self.victoriametrics_base_url()
        )
    }

    pub fn parse_bool(value: &str, key: &str) -> Result<bool, String> {
        match value {
            "true" => Ok(true),
            "false" => Ok(false),
            other => Err(format!("{key}: expected true or false, got {other}")),
        }
    }

    pub fn parse_u16(value: &str, key: &str) -> Result<u16, String> {
        value.parse().map_err(|_| format!("{key}: invalid u16"))
    }

    pub fn parse_u32(value: &str, key: &str) -> Result<u32, String> {
        value.parse().map_err(|_| format!("{key}: invalid u32"))
    }

    pub fn parse_u64(value: &str, key: &str) -> Result<u64, String> {
        value.parse().map_err(|_| format!("{key}: invalid u64"))
    }

    pub fn from_map(values: &std::collections::HashMap<String, String>) -> Result<Self, String> {
        let get = |key: &str| {
            values
                .get(key)
                .map(String::as_str)
                .ok_or_else(|| format!("missing required setting: {key}"))
        };

        Ok(Self {
            pinger_timeout_ms: Self::parse_u64(get("pinger_timeout_ms")?, "pinger_timeout_ms")?,
            pinger_retry_attempts: Self::parse_u32(
                get("pinger_retry_attempts")?,
                "pinger_retry_attempts",
            )?,
            pinger_retry_delay_ms: Self::parse_u64(
                get("pinger_retry_delay_ms")?,
                "pinger_retry_delay_ms",
            )?,
            dns_cache_enabled: Self::parse_bool(get("dns_cache_enabled")?, "dns_cache_enabled")?,
            dns_cache_ttl_minutes: Self::parse_u32(
                get("dns_cache_ttl_minutes")?,
                "dns_cache_ttl_minutes",
            )?,
            victoriametrics_url: get("victoriametrics_url")?.to_string(),
            metrics_push_cron: get("metrics_push_cron")?.to_string(),
            sign_up_enabled: Self::parse_bool(get("sign_up_enabled")?, "sign_up_enabled")?,
            www_origin: get("www_origin")?.to_string(),
        })
    }

    pub fn validate_www_origin(origin: &str) -> Result<(), String> {
        let origin = origin.trim();
        if origin.is_empty() {
            return Ok(());
        }
        if !origin.starts_with("http://") && !origin.starts_with("https://") {
            return Err("www_origin must start with http:// or https://".into());
        }
        if origin.chars().any(char::is_control) {
            return Err("www_origin contains invalid characters".into());
        }
        Ok(())
    }

    /// Origins allowed for browser CORS (Vite dev when `ENVIRONMENT=development` + configured www).
    pub fn cors_origin_candidates(
        &self,
        deployment_environment: &str,
        allow_same_origin_only: bool,
    ) -> Result<Vec<String>, String> {
        let mut origins = Vec::new();
        if deployment_environment == "development" {
            origins.push(settings_constants::VITE_DEV_ORIGIN.to_string());
        }
        let www = self.www_origin.trim();
        if !www.is_empty() {
            Self::validate_www_origin(www)?;
            if !origins.iter().any(|o| o == www) {
                origins.push(www.to_string());
            }
        }
        if origins.is_empty() {
            if allow_same_origin_only {
                return Ok(vec![]);
            }
            return Err(
                "no CORS origins configured; set www_origin or set ENVIRONMENT=development".into(),
            );
        }
        Ok(origins)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn victoriametrics_urls_derived_from_base() {
        let settings = AppSettings::default();
        assert_eq!(settings.victoriametrics_base_url(), "http://localhost:8428");
        assert_eq!(
            settings.victoriametrics_import_url(),
            "http://localhost:8428/api/v1/import/prometheus"
        );

        let mut trailing = settings;
        trailing.victoriametrics_url = "http://vm.example:8428/".into();
        assert_eq!(
            trailing.victoriametrics_import_url(),
            "http://vm.example:8428/api/v1/import/prometheus"
        );
    }

    #[test]
    fn cors_origin_candidates_includes_vite_in_development() {
        let settings = AppSettings::default();
        let origins = settings
            .cors_origin_candidates("development", false)
            .unwrap();
        assert_eq!(origins, vec!["http://localhost:5173"]);
    }

    #[test]
    fn cors_origin_candidates_adds_www_origin() {
        let settings = AppSettings {
            www_origin: "https://tracker.example.com".into(),
            ..Default::default()
        };
        let origins = settings
            .cors_origin_candidates("development", false)
            .unwrap();
        assert_eq!(
            origins,
            vec!["http://localhost:5173", "https://tracker.example.com"]
        );
    }

    #[test]
    fn cors_origin_candidates_requires_www_origin_in_production() {
        let settings = AppSettings::default();
        assert!(settings
            .cors_origin_candidates("production", false)
            .is_err());
        assert!(settings
            .cors_origin_candidates("production", true)
            .unwrap()
            .is_empty());
    }
}
