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
    pub llm_base_url: String,
    pub llm_model: String,
    pub llm_max_tool_rounds: u32,
    pub llm_context_max_turns: u32,
    pub llm_tool_max_tokens: u32,
    pub llm_final_max_tokens: u32,
    pub llm_context_max: u32,
    pub llm_context_reserve: u32,
    pub llm_timeout_secs: u64,
    pub llm_provider: String,
    pub llm_parallel_slots: u32,
    /// Masked placeholder when configured; omitted when unset.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_api_key: Option<String>,
}
