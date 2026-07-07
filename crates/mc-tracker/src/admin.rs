use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch};
use axum::{Json, Router};
use mc_api_types::{
    AdminServersListResponse, AdminUsersListResponse, ApiError, ApiErrorCode, CreateServerRequest,
    PatchSettingRequest, PatchUserFlagsRequest, PatchUserFlagsResponse, SettingsListResponse,
    UpdateServerRequest,
};
use mc_db::db::repos::servers::{self, NewServer, UpdateServer};
use mc_db::db::repos::users;
use mc_db::error::DbError;
use mc_db::model::{Platform, User, UserFlags};
use mc_settings::{SettingKey, SettingsError};
use uuid::Uuid;

use crate::api::AppState;
use crate::manager::admin_server_response;
use crate::settings_api::{to_setting_response, to_settings_list};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/servers", get(list_servers).post(create_server))
        .route(
            "/servers/{id}",
            get(get_server).patch(update_server).delete(delete_server),
        )
        .route("/settings", get(get_settings))
        .route("/settings/{key}", patch(patch_setting))
        .route("/users", get(list_users))
        .route("/users/{id}/flags", patch(patch_user_flags))
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
    if body
        .name
        .as_ref()
        .is_some_and(|value| value.trim().is_empty())
        || body
            .host
            .as_ref()
            .is_some_and(|value| value.trim().is_empty())
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
            paused: body.paused,
        },
    )
    .await
    {
        Ok(server) => {
            if !state.manager.update_server_config(server.clone()).await {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiError::new(
                        ApiErrorCode::InternalError,
                        "server missing from memory",
                    )),
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
            Json(ApiError::new(
                ApiErrorCode::NotFound,
                format!("server {id}"),
            )),
        )
            .into_response(),
        Err(err) => map_db_error(err),
    }
}

async fn get_settings(State(state): State<AppState>) -> Json<SettingsListResponse> {
    let items = state.manager.settings().list_all().await;
    Json(to_settings_list(items))
}

async fn patch_setting(
    State(state): State<AppState>,
    Path(key): Path<String>,
    Json(body): Json<PatchSettingRequest>,
) -> Response {
    let setting_key = match SettingKey::from_key(&key) {
        Ok(key) => key,
        Err(message) => return bad_request(&message),
    };

    match state.manager.settings().update(&key, body.value).await {
        Ok(item) => {
            state.manager.on_setting_updated(setting_key).await;
            Json(to_setting_response(item)).into_response()
        }
        Err(SettingsError::Validation(message)) => bad_request(&message),
        Err(SettingsError::Database(err)) => map_db_error(err),
    }
}

async fn list_users(State(state): State<AppState>) -> Response {
    match users::list(&state.pool).await {
        Ok(users) => Json(AdminUsersListResponse {
            users: users.iter().map(admin_user_response).collect(),
        })
        .into_response(),
        Err(err) => map_db_error(err),
    }
}

async fn patch_user_flags(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchUserFlagsRequest>,
) -> Response {
    let flags = UserFlags::from_db(body.flags);
    match users::update_flags(&state.pool, id, flags).await {
        Ok(()) => (
            StatusCode::OK,
            Json(PatchUserFlagsResponse {
                id: id.to_string(),
                flags: flags.to_db(),
            }),
        )
            .into_response(),
        Err(err) => map_db_error(err),
    }
}

fn admin_user_response(user: &User) -> mc_api_types::AdminUser {
    mc_api_types::AdminUser {
        id: user.id.to_string(),
        username: user.username.clone(),
        role: user.role.as_str().to_string(),
        flags: user.flags.to_db(),
        created_at: user.created_at.to_rfc3339(),
    }
}

fn parse_platform(value: &str) -> Result<Platform, String> {
    Platform::from_db(value)
}

fn bad_request(message: &str) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(ApiError::new(ApiErrorCode::BadRequest, message)),
    )
        .into_response()
}

fn map_db_error(err: DbError) -> Response {
    let (status, code, message) = match err {
        DbError::NotFound(message) => (StatusCode::NOT_FOUND, ApiErrorCode::NotFound, message),
        DbError::Conflict(message) => (StatusCode::CONFLICT, ApiErrorCode::Conflict, message),
        DbError::InvalidSettings(message) => {
            (StatusCode::BAD_REQUEST, ApiErrorCode::BadRequest, message)
        }
        other => (
            StatusCode::INTERNAL_SERVER_ERROR,
            ApiErrorCode::InternalError,
            other.to_string(),
        ),
    };
    (status, Json(ApiError::new(code, message))).into_response()
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use mc_db::model::{Platform, Server};
    use mc_settings::SettingsStore;
    use mc_test_support::fixture_geo;
    use uuid::Uuid;

    use super::parse_platform;
    use crate::manager::ServerManager;

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
            peak_players: None,
            peak_players_timestamp: None,
            paused: false,
        };
        let settings = SettingsStore::for_testing("development");
        let manager = ServerManager::new(
            vec![server],
            None,
            settings,
            fixture_geo(),
            None,
            "development",
            mc_test_support::test_insights("http://127.0.0.1:8428", "development"),
        );

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
}
