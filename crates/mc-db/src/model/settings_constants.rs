pub const PINGER_TIMEOUT_MS: u64 = 5000;
pub const PINGER_RETRY_ATTEMPTS: u32 = 3;
pub const PINGER_RETRY_DELAY_MS: u64 = 1000;
pub const DNS_CACHE_ENABLED: bool = true;
pub const DNS_CACHE_TTL_MINUTES: u32 = 5;
pub const VICTORIAMETRICS_URL: &str = "http://localhost:8428";
pub const METRICS_PUSH_CRON: &str = "*/10 * * * * *";
pub const SIGN_UP_ENABLED: bool = false;

pub const KEY_PINGER_TIMEOUT_MS: &str = "pinger_timeout_ms";
pub const KEY_PINGER_RETRY_ATTEMPTS: &str = "pinger_retry_attempts";
pub const KEY_PINGER_RETRY_DELAY_MS: &str = "pinger_retry_delay_ms";
pub const KEY_DNS_CACHE_ENABLED: &str = "dns_cache_enabled";
pub const KEY_DNS_CACHE_TTL_MINUTES: &str = "dns_cache_ttl_minutes";
pub const KEY_VICTORIAMETRICS_URL: &str = "victoriametrics_url";
pub const KEY_METRICS_PUSH_CRON: &str = "metrics_push_cron";
pub const KEY_SIGN_UP_ENABLED: &str = "sign_up_enabled";
pub const KEY_WWW_ORIGIN: &str = "www_origin";

/// Vite dev server origin when `ENVIRONMENT=development`.
pub const VITE_DEV_ORIGIN: &str = "http://localhost:5173";
