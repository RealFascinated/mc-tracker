use serde::Deserialize;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchSettingsRequest {
    pub pinger_timeout_ms: Option<u64>,
    pub pinger_retry_attempts: Option<u32>,
    pub pinger_retry_delay_ms: Option<u64>,
    pub dns_cache_enabled: Option<bool>,
    pub dns_cache_ttl_minutes: Option<u32>,
    pub victoriametrics_url: Option<String>,
    pub metrics_push_cron: Option<String>,
    pub sign_up_enabled: Option<bool>,
    pub www_origin: Option<String>,
}
