use mc_api_types::PatchSettingsRequest;
use mc_db::AppSettings;
use std::str::FromStr;

use cron::Schedule;

const LLM_PROVIDERS: &[&str] = &["llama_cpp", "openrouter", "openai_compatible"];

pub fn merge_settings(current: &AppSettings, patch: &PatchSettingsRequest) -> AppSettings {
    let mut next = current.clone();
    if let Some(value) = patch.pinger_timeout_ms {
        next.pinger_timeout_ms = value;
    }
    if let Some(value) = patch.pinger_retry_attempts {
        next.pinger_retry_attempts = value;
    }
    if let Some(value) = patch.pinger_retry_delay_ms {
        next.pinger_retry_delay_ms = value;
    }
    if let Some(value) = patch.dns_cache_enabled {
        next.dns_cache_enabled = value;
    }
    if let Some(value) = patch.dns_cache_ttl_minutes {
        next.dns_cache_ttl_minutes = value;
    }
    if let Some(value) = &patch.victoriametrics_url {
        next.victoriametrics_url = value.trim().to_string();
    }
    if let Some(value) = &patch.metrics_push_cron {
        next.metrics_push_cron = value.trim().to_string();
    }
    if let Some(value) = patch.sign_up_enabled {
        next.sign_up_enabled = value;
    }
    if let Some(value) = &patch.www_origin {
        next.www_origin = value.trim().to_string();
    }
    if let Some(value) = &patch.llm_base_url {
        next.llm_base_url = value.trim().to_string();
    }
    if let Some(value) = &patch.llm_model {
        next.llm_model = value.trim().to_string();
    }
    if let Some(value) = patch.llm_max_tool_rounds {
        next.llm_max_tool_rounds = value;
    }
    if let Some(value) = patch.llm_context_max_turns {
        next.llm_context_max_turns = value;
    }
    if let Some(value) = patch.llm_tool_max_tokens {
        next.llm_tool_max_tokens = value;
    }
    if let Some(value) = patch.llm_final_max_tokens {
        next.llm_final_max_tokens = value;
    }
    if let Some(value) = patch.llm_context_max {
        next.llm_context_max = value;
    }
    if let Some(value) = patch.llm_context_reserve {
        next.llm_context_reserve = value;
    }
    if let Some(value) = patch.llm_timeout_secs {
        next.llm_timeout_secs = value;
    }
    if let Some(value) = &patch.llm_provider {
        next.llm_provider = value.trim().to_string();
    }
    if let Some(value) = patch.llm_parallel_slots {
        next.llm_parallel_slots = value;
    }
    if let Some(value) = &patch.llm_api_key {
        next.llm_api_key = value.clone();
    }
    next
}

pub fn validate_settings(
    settings: &AppSettings,
    deployment_environment: &str,
) -> Result<(), String> {
    if settings.victoriametrics_url.trim().is_empty() {
        return Err("victoriametrics_url cannot be empty".into());
    }
    if settings.pinger_timeout_ms == 0 {
        return Err("pinger_timeout_ms must be greater than 0".into());
    }
    if settings.pinger_retry_attempts == 0 {
        return Err("pinger_retry_attempts must be greater than 0".into());
    }
    validate_metrics_push_cron(&settings.metrics_push_cron)?;
    AppSettings::validate_www_origin(&settings.www_origin)?;
    if deployment_environment != "development" && settings.www_origin.trim().is_empty() {
        return Err("www_origin is required when ENVIRONMENT is not development".into());
    }
    validate_llm_settings(settings)?;
    Ok(())
}

pub fn validate_llm_settings(settings: &AppSettings) -> Result<(), String> {
    if !LLM_PROVIDERS.contains(&settings.llm_provider.as_str()) {
        return Err(format!(
            "llm_provider must be one of: {}",
            LLM_PROVIDERS.join(", ")
        ));
    }
    if settings.llm_max_tool_rounds == 0 {
        return Err("llm_max_tool_rounds must be greater than 0".into());
    }
    if settings.llm_context_max_turns == 0 {
        return Err("llm_context_max_turns must be greater than 0".into());
    }
    if settings.llm_tool_max_tokens == 0 {
        return Err("llm_tool_max_tokens must be greater than 0".into());
    }
    if settings.llm_final_max_tokens == 0 {
        return Err("llm_final_max_tokens must be greater than 0".into());
    }
    if settings.llm_context_max == 0 {
        return Err("llm_context_max must be greater than 0".into());
    }
    if settings.llm_context_reserve == 0 {
        return Err("llm_context_reserve must be greater than 0".into());
    }
    if settings.llm_context_reserve >= settings.llm_context_max {
        return Err("llm_context_reserve must be less than llm_context_max".into());
    }
    if settings.llm_timeout_secs == 0 {
        return Err("llm_timeout_secs must be greater than 0".into());
    }
    Ok(())
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
    use mc_api_types::PatchSettingsRequest;
    use mc_db::AppSettings;

    use super::{merge_settings, validate_llm_settings};

    #[test]
    fn merge_settings_applies_only_provided_fields() {
        let current = AppSettings::default();
        let patch = PatchSettingsRequest {
            metrics_push_cron: Some("*/30 * * * * *".into()),
            ..Default::default()
        };
        let merged = merge_settings(&current, &patch);
        assert_eq!(merged.metrics_push_cron, "*/30 * * * * *");
        assert_eq!(merged.pinger_timeout_ms, current.pinger_timeout_ms);
    }

    #[test]
    fn merge_settings_llm_api_key_write_only() {
        let current = AppSettings {
            llm_api_key: "secret".into(),
            ..Default::default()
        };
        let patch = PatchSettingsRequest::default();
        let merged = merge_settings(&current, &patch);
        assert_eq!(merged.llm_api_key, "secret");

        let patch = PatchSettingsRequest {
            llm_api_key: Some("new-secret".into()),
            ..Default::default()
        };
        let merged = merge_settings(&current, &patch);
        assert_eq!(merged.llm_api_key, "new-secret");

        let patch = PatchSettingsRequest {
            llm_api_key: Some(String::new()),
            ..Default::default()
        };
        let merged = merge_settings(&current, &patch);
        assert!(merged.llm_api_key.is_empty());
    }

    #[test]
    fn validate_llm_context_reserve_less_than_max() {
        let settings = AppSettings {
            llm_context_reserve: 2048,
            llm_context_max: 16384,
            ..Default::default()
        };
        validate_llm_settings(&settings).unwrap();

        let settings = AppSettings {
            llm_context_reserve: 16384,
            llm_context_max: 16384,
            ..Default::default()
        };
        assert!(validate_llm_settings(&settings).is_err());
    }
}
