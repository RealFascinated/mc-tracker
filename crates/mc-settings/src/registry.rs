use std::str::FromStr;

use cron::Schedule;
use serde_json::{json, Value};

use crate::derived::validate_www_origin;
use crate::setting_type::{
    SettingType, BOOLEAN, ENUM_LLM_PROVIDER, ENUM_LLM_THINKING_EFFORT, INTEGER, STRING, STRING_LIST,
};
use crate::store::SettingsStore;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SettingKey {
    PingerTimeoutMs,
    PingerRetryAttempts,
    PingerRetryDelayMs,
    DnsCacheEnabled,
    DnsCacheTtlMinutes,
    VictoriametricsUrl,
    MetricsPushCron,
    SignUpEnabled,
    WwwOrigin,
    LlmBaseUrl,
    LlmModels,
    LlmMaxToolRounds,
    LlmContextMaxTurns,
    LlmToolMaxTokens,
    LlmFinalMaxTokens,
    LlmContextMax,
    LlmContextReserve,
    LlmTimeoutSecs,
    LlmProvider,
    LlmParallelSlots,
    LlmApiKey,
    LlmThinkingEnabled,
    LlmThinkingEffort,
}

impl SettingKey {
    pub const ALL: [Self; 23] = [
        Self::PingerTimeoutMs,
        Self::PingerRetryAttempts,
        Self::PingerRetryDelayMs,
        Self::DnsCacheEnabled,
        Self::DnsCacheTtlMinutes,
        Self::VictoriametricsUrl,
        Self::MetricsPushCron,
        Self::SignUpEnabled,
        Self::WwwOrigin,
        Self::LlmBaseUrl,
        Self::LlmModels,
        Self::LlmMaxToolRounds,
        Self::LlmContextMaxTurns,
        Self::LlmToolMaxTokens,
        Self::LlmFinalMaxTokens,
        Self::LlmContextMax,
        Self::LlmContextReserve,
        Self::LlmTimeoutSecs,
        Self::LlmProvider,
        Self::LlmParallelSlots,
        Self::LlmApiKey,
        Self::LlmThinkingEnabled,
        Self::LlmThinkingEffort,
    ];

    pub fn from_key(key: &str) -> Result<Self, String> {
        Self::ALL
            .into_iter()
            .find(|setting| setting.key() == key)
            .ok_or_else(|| format!("unknown setting: {key}"))
    }

    pub fn key(self) -> &'static str {
        match self {
            Self::PingerTimeoutMs => "pinger_timeout_ms",
            Self::PingerRetryAttempts => "pinger_retry_attempts",
            Self::PingerRetryDelayMs => "pinger_retry_delay_ms",
            Self::DnsCacheEnabled => "dns_cache_enabled",
            Self::DnsCacheTtlMinutes => "dns_cache_ttl_minutes",
            Self::VictoriametricsUrl => "victoriametrics_url",
            Self::MetricsPushCron => "metrics_push_cron",
            Self::SignUpEnabled => "sign_up_enabled",
            Self::WwwOrigin => "www_origin",
            Self::LlmBaseUrl => "llm_base_url",
            Self::LlmModels => "llm_models",
            Self::LlmMaxToolRounds => "llm_max_tool_rounds",
            Self::LlmContextMaxTurns => "llm_context_max_turns",
            Self::LlmToolMaxTokens => "llm_tool_max_tokens",
            Self::LlmFinalMaxTokens => "llm_final_max_tokens",
            Self::LlmContextMax => "llm_context_max",
            Self::LlmContextReserve => "llm_context_reserve",
            Self::LlmTimeoutSecs => "llm_timeout_secs",
            Self::LlmProvider => "llm_provider",
            Self::LlmParallelSlots => "llm_parallel_slots",
            Self::LlmApiKey => "llm_api_key",
            Self::LlmThinkingEnabled => "llm_thinking_enabled",
            Self::LlmThinkingEffort => "llm_thinking_effort",
        }
    }

    pub fn type_(self) -> &'static dyn SettingType {
        match self {
            Self::DnsCacheEnabled | Self::SignUpEnabled | Self::LlmThinkingEnabled => &BOOLEAN,
            Self::PingerTimeoutMs
            | Self::PingerRetryAttempts
            | Self::PingerRetryDelayMs
            | Self::DnsCacheTtlMinutes
            | Self::LlmMaxToolRounds
            | Self::LlmContextMaxTurns
            | Self::LlmToolMaxTokens
            | Self::LlmFinalMaxTokens
            | Self::LlmContextMax
            | Self::LlmContextReserve
            | Self::LlmTimeoutSecs
            | Self::LlmParallelSlots => &INTEGER,
            Self::LlmProvider => &ENUM_LLM_PROVIDER,
            Self::LlmThinkingEffort => &ENUM_LLM_THINKING_EFFORT,
            Self::LlmModels => &STRING_LIST,
            _ => &STRING,
        }
    }

    pub fn default_value(self) -> Value {
        match self {
            Self::PingerTimeoutMs => json!(5000),
            Self::PingerRetryAttempts => json!(3),
            Self::PingerRetryDelayMs => json!(1000),
            Self::DnsCacheEnabled => json!(true),
            Self::DnsCacheTtlMinutes => json!(5),
            Self::VictoriametricsUrl => json!("http://localhost:8428"),
            Self::MetricsPushCron => json!("*/10 * * * * *"),
            Self::SignUpEnabled => json!(false),
            Self::WwwOrigin => json!(""),
            Self::LlmBaseUrl => json!(""),
            Self::LlmModels => {
                json!(["openrouter/free", "deepseek/deepseek-v4-flash"])
            }
            Self::LlmMaxToolRounds => json!(8),
            Self::LlmContextMaxTurns => json!(10),
            Self::LlmToolMaxTokens => json!(1024),
            Self::LlmFinalMaxTokens => json!(2048),
            Self::LlmContextMax => json!(16384),
            Self::LlmContextReserve => json!(2048),
            Self::LlmTimeoutSecs => json!(60),
            Self::LlmProvider => json!("llama_cpp"),
            Self::LlmParallelSlots => json!(2),
            Self::LlmApiKey => json!(""),
            Self::LlmThinkingEnabled => json!(true),
            Self::LlmThinkingEffort => json!("medium"),
        }
    }

    pub fn is_public(self) -> bool {
        matches!(self, Self::SignUpEnabled)
    }

    pub fn is_secret(self) -> bool {
        matches!(self, Self::LlmApiKey)
    }

    pub fn validate_cross(self, store: &SettingsStore, value: &Value) -> Result<(), String> {
        match self {
            Self::VictoriametricsUrl => {
                let url = value.as_str().unwrap_or("").trim();
                if url.is_empty() {
                    return Err("victoriametrics_url cannot be empty".into());
                }
                Ok(())
            }
            Self::PingerTimeoutMs | Self::PingerRetryAttempts => {
                if value.as_u64().unwrap_or(0) == 0 {
                    return Err(format!("{} must be greater than 0", self.key()));
                }
                Ok(())
            }
            Self::MetricsPushCron => validate_metrics_push_cron(value.as_str().unwrap_or("")),
            Self::WwwOrigin => {
                let origin = value.as_str().unwrap_or("").trim();
                validate_www_origin(origin)?;
                if store.deployment_environment() != "development" && origin.is_empty() {
                    return Err("www_origin is required when ENVIRONMENT is not development".into());
                }
                Ok(())
            }
            Self::LlmMaxToolRounds
            | Self::LlmContextMaxTurns
            | Self::LlmToolMaxTokens
            | Self::LlmFinalMaxTokens
            | Self::LlmContextMax
            | Self::LlmContextReserve
            | Self::LlmTimeoutSecs
            | Self::LlmParallelSlots => {
                if value.as_u64().unwrap_or(0) == 0 {
                    return Err(format!("{} must be greater than 0", self.key()));
                }
                if self == Self::LlmContextReserve {
                    let max = store.cached_u32(SettingKey::LlmContextMax);
                    let reserve = value.as_u64().unwrap_or(0) as u32;
                    if reserve >= max {
                        return Err("llm_context_reserve must be less than llm_context_max".into());
                    }
                }
                if self == Self::LlmContextMax {
                    let reserve = store.cached_u32(SettingKey::LlmContextReserve);
                    let max = value.as_u64().unwrap_or(0) as u32;
                    if reserve >= max {
                        return Err("llm_context_reserve must be less than llm_context_max".into());
                    }
                }
                Ok(())
            }
            Self::LlmBaseUrl
            | Self::LlmModels
            | Self::LlmApiKey
            | Self::DnsCacheEnabled
            | Self::PingerRetryDelayMs
            | Self::DnsCacheTtlMinutes
            | Self::SignUpEnabled
            | Self::LlmThinkingEnabled
            | Self::LlmThinkingEffort
            | Self::LlmProvider => Ok(()),
        }
    }

    pub fn side_effects(self) -> SettingSideEffects {
        match self {
            Self::DnsCacheEnabled | Self::DnsCacheTtlMinutes => SettingSideEffects::DNS,
            Self::VictoriametricsUrl => SettingSideEffects::VM_URL,
            _ => SettingSideEffects::NONE,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SettingSideEffects {
    pub dns: bool,
    pub vm_url: bool,
}

impl SettingSideEffects {
    pub const NONE: Self = Self {
        dns: false,
        vm_url: false,
    };
    pub const DNS: Self = Self {
        dns: true,
        vm_url: false,
    };
    pub const VM_URL: Self = Self {
        dns: false,
        vm_url: true,
    };
}

pub fn validate_metrics_push_cron(expr: &str) -> Result<(), String> {
    let expr = expr.trim();
    if expr.is_empty() {
        return Err("metrics_push_cron cannot be empty".into());
    }
    Schedule::from_str(expr)
        .map(|_| ())
        .map_err(|err| format!("metrics_push_cron: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_key_resolves_known_keys() {
        assert_eq!(
            SettingKey::from_key("sign_up_enabled").unwrap(),
            SettingKey::SignUpEnabled
        );
    }

    #[test]
    fn from_key_rejects_unknown() {
        assert!(SettingKey::from_key("nope").is_err());
    }

    #[test]
    fn validate_metrics_push_cron_accepts_six_field() {
        validate_metrics_push_cron("*/10 * * * * *").unwrap();
    }
}
