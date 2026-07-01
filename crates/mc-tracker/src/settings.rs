use mc_api_types::PatchSettingsRequest;
use mc_db::AppSettings;
use std::str::FromStr;

use cron::Schedule;

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

    use super::merge_settings;

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
}
