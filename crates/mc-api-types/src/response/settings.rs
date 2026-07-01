use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsResponse {
    pub pinger_timeout_ms: u64,
    pub pinger_retry_attempts: u32,
    pub pinger_retry_delay_ms: u64,
    pub dns_cache_enabled: bool,
    pub dns_cache_ttl_minutes: u32,
    pub victoriametrics_url: String,
    pub metrics_push_cron: String,
    pub sign_up_enabled: bool,
    pub www_origin: String,
}
