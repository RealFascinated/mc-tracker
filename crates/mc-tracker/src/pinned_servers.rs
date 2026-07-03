use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, put};
use axum::{Json, Router};
use mc_api_types::{
    ErrorResponse, PinServerRequest, PinnedServersListResponse, ReorderPinnedServersRequest,
};
use mc_db::db::repos::{pinned_servers, servers};
use mc_db::DbError;
use uuid::Uuid;

use crate::api::AppState;
use crate::auth::AuthUser;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/pinned-servers", get(list_pinned_servers).post(pin_server))
        .route("/pinned-servers/order", put(reorder_pinned_servers))
        .route("/pinned-servers/{server_id}", delete(unpin_server))
}

async fn list_pinned_servers(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<PinnedServersListResponse>, Response> {
    build_pinned_response(&state, user.id).await
}

async fn pin_server(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<PinServerRequest>,
) -> Result<Json<PinnedServersListResponse>, Response> {
    let server_id = match Uuid::parse_str(body.server_id.trim()) {
        Ok(id) => id,
        Err(_) => return Err(bad_request("invalid server id")),
    };

    if servers::get(&state.pool, server_id).await.is_err() {
        return Err(not_found("server not found"));
    }

    if !state.manager.is_server_tracked(server_id).await {
        return Err(not_found("server not found"));
    }

    match pinned_servers::insert(&state.pool, user.id, server_id).await {
        Ok(_) => build_pinned_response(&state, user.id).await,
        Err(DbError::Conflict(message)) => Err(conflict(&message)),
        Err(err) => Err(map_db_error(err)),
    }
}

async fn unpin_server(
    State(state): State<AppState>,
    user: AuthUser,
    Path(server_id): Path<Uuid>,
) -> Result<Json<PinnedServersListResponse>, Response> {
    match pinned_servers::delete(&state.pool, user.id, server_id).await {
        Ok(()) => build_pinned_response(&state, user.id).await,
        Err(DbError::NotFound(message)) => Err(not_found(&message)),
        Err(err) => Err(map_db_error(err)),
    }
}

async fn reorder_pinned_servers(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<ReorderPinnedServersRequest>,
) -> Result<Json<PinnedServersListResponse>, Response> {
    let mut server_ids = Vec::with_capacity(body.server_ids.len());
    for server_id in body.server_ids {
        let id = Uuid::parse_str(server_id.trim())
            .map_err(|_| bad_request("invalid server id"))?;
        server_ids.push(id);
    }

    match pinned_servers::reorder(&state.pool, user.id, &server_ids).await {
        Ok(()) => build_pinned_response(&state, user.id).await,
        Err(DbError::InvalidSettings(message)) => Err(bad_request(&message)),
        Err(err) => Err(map_db_error(err)),
    }
}

async fn build_pinned_response(
    state: &AppState,
    user_id: Uuid,
) -> Result<Json<PinnedServersListResponse>, Response> {
    let pins = pinned_servers::list_by_user(&state.pool, user_id)
        .await
        .map_err(map_db_error)?;
    let server_ids: Vec<Uuid> = pins.iter().map(|pin| pin.server_id).collect();
    let servers = state.manager.server_list_items_by_ids(&server_ids).await;

    Ok(Json(PinnedServersListResponse { servers }))
}

fn not_found(message: &str) -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(ErrorResponse::new(message)),
    )
        .into_response()
}

fn conflict(message: &str) -> Response {
    (
        StatusCode::CONFLICT,
        Json(ErrorResponse::new(message)),
    )
        .into_response()
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
