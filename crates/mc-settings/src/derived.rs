pub const LLM_API_KEY_MASK: &str = "********";
pub const VITE_DEV_ORIGIN: &str = "http://localhost:5173";

pub fn chat_enabled(base_url: &str) -> bool {
    !base_url.trim().is_empty()
}

pub fn victoriametrics_base_url(url: &str) -> &str {
    url.trim_end_matches('/')
}

pub fn victoriametrics_import_url(base: &str) -> String {
    format!(
        "{}/api/v1/import/prometheus",
        victoriametrics_base_url(base)
    )
}

pub fn validate_www_origin(origin: &str) -> Result<(), String> {
    let origin = origin.trim();
    if origin.is_empty() {
        return Ok(());
    }
    if !origin.starts_with("http://") && !origin.starts_with("https://") {
        return Err("www_origin must start with http:// or https://".into());
    }
    if origin.chars().any(char::is_control) {
        return Err("www_origin contains invalid characters".into());
    }
    Ok(())
}

/// Origins allowed for browser CORS (Vite dev when `ENVIRONMENT=development` + configured www).
pub fn cors_origin_candidates(
    www_origin: &str,
    deployment_environment: &str,
    allow_same_origin_only: bool,
) -> Result<Vec<String>, String> {
    let mut origins = Vec::new();
    if deployment_environment == "development" {
        origins.push(VITE_DEV_ORIGIN.to_string());
    }
    let www = www_origin.trim();
    if !www.is_empty() {
        validate_www_origin(www)?;
        if !origins.iter().any(|o| o == www) {
            origins.push(www.to_string());
        }
    }
    if origins.is_empty() {
        if allow_same_origin_only {
            return Ok(vec![]);
        }
        return Err(
            "no CORS origins configured; set www_origin or set ENVIRONMENT=development".into(),
        );
    }
    Ok(origins)
}
