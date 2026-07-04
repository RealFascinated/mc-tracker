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
    pub llm_base_url: Option<String>,
    pub llm_model: Option<String>,
    pub llm_max_tool_rounds: Option<u32>,
    pub llm_context_max_turns: Option<u32>,
    pub llm_tool_max_tokens: Option<u32>,
    pub llm_final_max_tokens: Option<u32>,
    pub llm_context_max: Option<u32>,
    pub llm_context_reserve: Option<u32>,
    pub llm_timeout_secs: Option<u64>,
    pub llm_provider: Option<String>,
    pub llm_parallel_slots: Option<u32>,
    /// Write-only: omit to leave unchanged, empty string clears.
    pub llm_api_key: Option<String>,
}
