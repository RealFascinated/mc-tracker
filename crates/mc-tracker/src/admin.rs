use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use mc_api_types::{
    AdminServersListResponse, CreateServerRequest, ErrorResponse, PatchSettingsRequest,
    SettingsResponse, UpdateServerRequest,
};
use mc_db::db::repos::servers::{self, NewServer, UpdateServer};
use mc_db::db::repos::settings;
use mc_db::error::DbError;
use mc_db::model::Platform;
use mc_db::AppSettings;
use uuid::Uuid;

use crate::api::AppState;
use crate::manager::{admin_server_response, settings_response};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/servers", get(list_servers).post(create_server))
        .route(
            "/servers/{id}",
            get(get_server).patch(update_server).delete(delete_server),
        )
        .route("/settings", get(get_settings).patch(patch_settings))
}

async fn list_servers(State(state): State<AppState>) -> Json<AdminServersListResponse> {
    Json(state.manager.admin_servers_list().await)
}

async fn create_server(
    State(state): State<AppState>,
    Json(body): Json<CreateServerRequest>,
) -> Response {
    let name = body.name.trim();
    let host = body.host.trim();
    if name.is_empty() || host.is_empty() {
        return bad_request("name and host are required");
    }

    let platform = match parse_platform(&body.server_type) {
        Ok(platform) => platform,
        Err(message) => return bad_request(&message),
    };

    match servers::insert(
        &state.pool,
        NewServer {
            id: None,
            name,
            host,
            port: body.port,
            platform,
        },
    )
    .await
    {
        Ok(server) => {
            state.manager.append_server(server.clone()).await;
            (StatusCode::CREATED, Json(admin_server_response(&server))).into_response()
        }
        Err(err) => map_db_error(err),
    }
}

async fn get_server(State(state): State<AppState>, Path(id): Path<Uuid>) -> Response {
    match servers::get(&state.pool, id).await {
        Ok(server) => Json(admin_server_response(&server)).into_response(),
        Err(err) => map_db_error(err),
    }
}

async fn update_server(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateServerRequest>,
) -> Response {
    if body.name.as_ref().is_some_and(|value| value.trim().is_empty())
        || body.host.as_ref().is_some_and(|value| value.trim().is_empty())
    {
        return bad_request("name and host cannot be empty");
    }

    let platform = match body.server_type.as_deref() {
        Some(value) => match parse_platform(value) {
            Ok(platform) => Some(platform),
            Err(message) => return bad_request(&message),
        },
        None => None,
    };

    match servers::update(
        &state.pool,
        id,
        UpdateServer {
            name: body.name.as_deref().map(str::trim),
            host: body.host.as_deref().map(str::trim),
            port: body.port.map(Some),
            platform,
        },
    )
    .await
    {
        Ok(server) => {
            if !state.manager.update_server_config(server.clone()).await {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse::new("server missing from memory")),
                )
                    .into_response();
            }
            Json(admin_server_response(&server)).into_response()
        }
        Err(err) => map_db_error(err),
    }
}

async fn delete_server(State(state): State<AppState>, Path(id): Path<Uuid>) -> Response {
    match servers::delete(&state.pool, id).await {
        Ok(deleted) if deleted => {
            state.manager.remove_server(id).await;
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new(format!("server {id}"))),
        )
            .into_response(),
        Err(err) => map_db_error(err),
    }
}

async fn get_settings(State(state): State<AppState>) -> Json<SettingsResponse> {
    let current = state.manager.settings().await;
    Json(settings_response(&current))
}

async fn patch_settings(
    State(state): State<AppState>,
    Json(body): Json<PatchSettingsRequest>,
) -> Response {
    let current = state.manager.settings().await;
    let updated = merge_settings(&current, &body);
    if let Err(message) = validate_settings(&updated, state.manager.environment()) {
        return bad_request(&message);
    }

    match settings::save(&state.pool, &updated).await {
        Ok(()) => {
            state.manager.apply_settings(updated.clone()).await;
            Json(settings_response(&updated)).into_response()
        }
        Err(err) => map_db_error(err),
    }
}

fn merge_settings(current: &AppSettings, patch: &PatchSettingsRequest) -> AppSettings {
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

fn validate_settings(settings: &AppSettings, deployment_environment: &str) -> Result<(), String> {
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

fn parse_platform(value: &str) -> Result<Platform, String> {
    Platform::from_db(value)
}

fn bad_request(message: &str) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse::new(message)),
    )
        .into_response()
}

fn map_db_error(err: DbError) -> Response {
    let (status, message) = match err {
        DbError::NotFound(message) => (StatusCode::NOT_FOUND, message),
        DbError::Conflict(message) => (StatusCode::CONFLICT, message),
        DbError::InvalidSettings(message) => (StatusCode::BAD_REQUEST, message),
        other => (StatusCode::INTERNAL_SERVER_ERROR, other.to_string()),
    };
    (status, Json(ErrorResponse::new(message))).into_response()
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use chrono::Utc;
    use mc_db::model::{Platform, Server};
    use mc_db::AppSettings;
    use mc_geo::GeoService;
    use tokio::sync::RwLock;
    use uuid::Uuid;

    use super::{merge_settings, parse_platform, validate_settings};
    use crate::manager::ServerManager;
    use mc_api_types::PatchSettingsRequest;

    fn fixture_geo() -> Arc<GeoService> {
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../mc-geo/tests/fixtures/GeoLite2-ASN-Test.mmdb");
        Arc::new(GeoService::from_database_file(path).unwrap())
    }

    #[tokio::test]
    async fn admin_servers_list_returns_config_fields() {
        let server = Server {
            id: Uuid::parse_str("b8dd1998-c3c8-4248-905c-52c26092baf5").unwrap(),
            name: "Hypixel".into(),
            host: "mc.hypixel.net".into(),
            port: None,
            platform: Platform::Pc,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let bootstrap = settings.read().await.clone();
        let manager = ServerManager::new(vec![server], settings, fixture_geo(), None, &bootstrap, "development");

        let response = manager.admin_servers_list().await;
        assert_eq!(response.servers.len(), 1);
        assert_eq!(response.servers[0].name, "Hypixel");
        assert_eq!(response.servers[0].server_type, "PC");
        assert_eq!(response.servers[0].host, "mc.hypixel.net");
    }

    #[test]
    fn parse_platform_accepts_pc_and_pe() {
        assert_eq!(parse_platform("PC").unwrap(), Platform::Pc);
        assert_eq!(parse_platform("PE").unwrap(), Platform::Pe);
        assert!(parse_platform("XBOX").is_err());
    }

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
