use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use mc_api_types::{
    ApiError, ApiErrorCode, CreateServerSuggestionRequest, ServerSuggestionResponse,
    ServerSuggestionsListResponse, SuggestionAuthorResponse,
};
use mc_db::db::repos::{server_suggestions, servers};
use mc_db::error::DbError;
use mc_db::model::{Platform, ServerSuggestion};

use crate::api::AppState;
use crate::auth::AuthUser;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/server-suggestions", post(submit_suggestion))
        .route("/server-suggestions/mine", get(list_my_suggestions))
}

async fn submit_suggestion(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateServerSuggestionRequest>,
) -> Response {
    let name = body.name.trim();
    let host = body.host.trim();
    if name.is_empty() || host.is_empty() {
        return bad_request("name and host are required");
    }

    let platform = match Platform::from_db(&body.server_type) {
        Ok(platform) => platform,
        Err(message) => return bad_request(&message),
    };

    match servers::find_by_host_port_platform(&state.pool, host, body.port, platform).await {
        Ok(Some(_)) => return conflict("server is already tracked"),
        Ok(None) => (),
        Err(err) => return map_db_error(err),
    };

    match server_suggestions::insert(
        &state.pool,
        server_suggestions::NewServerSuggestion {
            user_id: user.id,
            name,
            host,
            port: body.port,
            platform,
        },
    )
    .await
    {
        Ok(suggestion) => (
            StatusCode::CREATED,
            Json(suggestion_response(&suggestion, None)),
        )
            .into_response(),
        Err(DbError::Conflict(message)) => conflict(&message),
        Err(err) => map_db_error(err),
    }
}

async fn list_my_suggestions(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<ServerSuggestionsListResponse>, Response> {
    let suggestions = server_suggestions::list_by_user(&state.pool, user.id)
        .await
        .map_err(map_db_error)?;
    Ok(Json(ServerSuggestionsListResponse {
        suggestions: suggestions
            .iter()
            .map(|suggestion| suggestion_response(suggestion, None))
            .collect(),
    }))
}

pub(crate) fn suggestion_response(
    suggestion: &ServerSuggestion,
    author: Option<SuggestionAuthorResponse>,
) -> ServerSuggestionResponse {
    ServerSuggestionResponse {
        id: suggestion.id.to_string(),
        name: suggestion.name.clone(),
        host: suggestion.host.clone(),
        port: suggestion.port,
        server_type: suggestion.platform.as_str().to_string(),
        status: suggestion.status.as_str().to_string(),
        suggested_by: author,
        created_at: suggestion.created_at.to_rfc3339(),
        updated_at: suggestion.updated_at.to_rfc3339(),
    }
}

fn conflict(message: &str) -> Response {
    (
        StatusCode::CONFLICT,
        Json(ApiError::new(ApiErrorCode::Conflict, message)),
    )
        .into_response()
}

fn bad_request(message: &str) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(ApiError::new(ApiErrorCode::BadRequest, message)),
    )
        .into_response()
}

pub(crate) fn map_db_error(err: DbError) -> Response {
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
