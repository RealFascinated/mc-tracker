use mc_api_types::PatchSettingsRequest;
use mc_db::AppSettings;

pub fn merge_settings(current: &AppSettings, patch: &PatchSettingsRequest) -> AppSettings {
    let mut next = current.clone();
    if let Some(value) = patch.api_port {
        next.api_port = value;
    }
    if let Some(value) = &patch.api_address {
        next.api_address = value.trim().to_string();
    }
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
    if let Some(value) = patch.metrics_push_interval_seconds {
        next.metrics_push_interval_seconds = value;
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
    if settings.api_address.trim().is_empty() {
        return Err("api_address cannot be empty".into());
    }
    settings.api_socket_addr()?;
    if settings.victoriametrics_url.trim().is_empty() {
        return Err("victoriametrics_url cannot be empty".into());
    }
    if settings.pinger_timeout_ms == 0 {
        return Err("pinger_timeout_ms must be greater than 0".into());
    }
    if settings.pinger_retry_attempts == 0 {
        return Err("pinger_retry_attempts must be greater than 0".into());
    }
    if settings.metrics_push_interval_seconds == 0 {
        return Err("metrics_push_interval_seconds must be greater than 0".into());
    }
    AppSettings::validate_www_origin(&settings.www_origin)?;
    if deployment_environment != "development" && settings.www_origin.trim().is_empty() {
        return Err("www_origin is required when ENVIRONMENT is not development".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use mc_api_types::PatchSettingsRequest;
    use mc_db::AppSettings;

    use super::{merge_settings, validate_settings};

    #[test]
    fn merge_settings_applies_only_provided_fields() {
        let current = AppSettings::default();
        let patch = PatchSettingsRequest {
            metrics_push_interval_seconds: Some(30),
            ..Default::default()
        };
        let merged = merge_settings(&current, &patch);
        assert_eq!(merged.metrics_push_interval_seconds, 30);
        assert_eq!(merged.api_port, current.api_port);
    }

    #[test]
    fn validate_settings_rejects_invalid_api_address() {
        let settings = AppSettings {
            api_address: "not-an-ip".into(),
            ..Default::default()
        };
        assert!(validate_settings(&settings, "development").is_err());
    }
}
