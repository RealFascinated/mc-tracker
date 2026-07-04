pub const PINGER_TIMEOUT_MS: u64 = 5000;
pub const PINGER_RETRY_ATTEMPTS: u32 = 3;
pub const PINGER_RETRY_DELAY_MS: u64 = 1000;
pub const DNS_CACHE_ENABLED: bool = true;
pub const DNS_CACHE_TTL_MINUTES: u32 = 5;
pub const VICTORIAMETRICS_URL: &str = "http://localhost:8428";
pub const METRICS_PUSH_CRON: &str = "*/10 * * * * *";
pub const SIGN_UP_ENABLED: bool = false;

pub const LLM_MODEL: &str = "default";
pub const LLM_MAX_TOOL_ROUNDS: u32 = 8;
pub const LLM_CONTEXT_MAX_TURNS: u32 = 10;
pub const LLM_TOOL_MAX_TOKENS: u32 = 1024;
pub const LLM_FINAL_MAX_TOKENS: u32 = 2048;
pub const LLM_CONTEXT_MAX: u32 = 16384;
pub const LLM_CONTEXT_RESERVE: u32 = 2048;
pub const LLM_TIMEOUT_SECS: u64 = 60;
pub const LLM_PROVIDER: &str = "llama_cpp";
pub const LLM_PARALLEL_SLOTS: u32 = 2;

pub const KEY_PINGER_TIMEOUT_MS: &str = "pinger_timeout_ms";
pub const KEY_PINGER_RETRY_ATTEMPTS: &str = "pinger_retry_attempts";
pub const KEY_PINGER_RETRY_DELAY_MS: &str = "pinger_retry_delay_ms";
pub const KEY_DNS_CACHE_ENABLED: &str = "dns_cache_enabled";
pub const KEY_DNS_CACHE_TTL_MINUTES: &str = "dns_cache_ttl_minutes";
pub const KEY_VICTORIAMETRICS_URL: &str = "victoriametrics_url";
pub const KEY_METRICS_PUSH_CRON: &str = "metrics_push_cron";
pub const KEY_SIGN_UP_ENABLED: &str = "sign_up_enabled";
pub const KEY_WWW_ORIGIN: &str = "www_origin";
pub const KEY_LLM_BASE_URL: &str = "llm_base_url";
pub const KEY_LLM_MODEL: &str = "llm_model";
pub const KEY_LLM_MAX_TOOL_ROUNDS: &str = "llm_max_tool_rounds";
pub const KEY_LLM_CONTEXT_MAX_TURNS: &str = "llm_context_max_turns";
pub const KEY_LLM_TOOL_MAX_TOKENS: &str = "llm_tool_max_tokens";
pub const KEY_LLM_FINAL_MAX_TOKENS: &str = "llm_final_max_tokens";
pub const KEY_LLM_CONTEXT_MAX: &str = "llm_context_max";
pub const KEY_LLM_CONTEXT_RESERVE: &str = "llm_context_reserve";
pub const KEY_LLM_TIMEOUT_SECS: &str = "llm_timeout_secs";
pub const KEY_LLM_PROVIDER: &str = "llm_provider";
pub const KEY_LLM_PARALLEL_SLOTS: &str = "llm_parallel_slots";
pub const KEY_LLM_API_KEY: &str = "llm_api_key";

/// Mask returned by admin settings API when an API key is configured.
pub const LLM_API_KEY_MASK: &str = "********";

/// Vite dev server origin when `ENVIRONMENT=development`.
pub const VITE_DEV_ORIGIN: &str = "http://localhost:5173";
