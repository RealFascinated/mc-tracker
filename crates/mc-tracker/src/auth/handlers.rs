use axum::extract::State;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use mc_api_types::{
    ApiError, ApiErrorCode, ChangePasswordRequest, LoginRequest, LoginResponse, MeResponse,
    SignupRequest,
};
use mc_db::db::repos::users;
use mc_db::model::{chat_quota_exempt, UserRole};

use super::middleware::{parse_cookie_value, AuthUser};
use super::rate_limit::client_ip_from_headers;
use super::session::COOKIE_NAME;
use crate::api::AppState;
use crate::chat_quota::quota_for_user;
use crate::manager::ServerManager;
use mc_settings::SettingKey;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/me", get(me))
        .route("/signup", post(signup))
        .route("/password", patch(change_password))
}

async fn login(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<LoginRequest>,
) -> Response {
    let ip = client_ip_from_headers(&headers);

    if state.auth.rate_limiter.check(ip).await.is_err() {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(ApiError::new(
                ApiErrorCode::TooManyRequests,
                "too many login attempts",
            )),
        )
            .into_response();
    }

    let username = body.username.trim();
    if username.is_empty() || body.password.is_empty() {
        return invalid_credentials();
    }

    let user = match users::get_by_username(&state.pool, username).await {
        Ok(user) => user,
        Err(_) => return invalid_credentials(),
    };

    if !users::verify_password(&body.password, &user.password_hash).unwrap_or(false) {
        return invalid_credentials();
    }

    issue_session(&state, &user).await
}

async fn logout(State(state): State<AppState>, headers: axum::http::HeaderMap) -> Response {
    if let Some(cookie_header) = headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok())
    {
        if let Some(token) = parse_cookie_value(cookie_header, COOKIE_NAME) {
            state.auth.sessions.revoke_token(&token).await;
        }
    }

    (
        StatusCode::NO_CONTENT,
        [(header::SET_COOKIE, state.auth.sessions.clear_cookie_value())],
    )
        .into_response()
}

async fn me(
    State(state): State<AppState>,
    AuthUser {
        id,
        username,
        role,
        flags,
        ..
    }: AuthUser,
) -> Result<Json<MeResponse>, Response> {
    let chat_quota = if chat_quota_exempt(role, flags) {
        None
    } else {
        Some(quota_for_user(&state.pool, id).await.map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(
                    ApiErrorCode::InternalError,
                    "failed to load chat quota",
                )),
            )
                .into_response()
        })?)
    };

    Ok(Json(MeResponse {
        username,
        role: role.as_str().to_string(),
        flags: flags.to_db(),
        chat_quota,
    }))
}

async fn signup(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<SignupRequest>,
) -> Response {
    if !sign_up_allowed(&state.manager) {
        return (
            StatusCode::FORBIDDEN,
            Json(ApiError::new(
                ApiErrorCode::Forbidden,
                "sign up is disabled",
            )),
        )
            .into_response();
    }

    let ip = client_ip_from_headers(&headers);
    if state.auth.rate_limiter.check(ip).await.is_err() {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(ApiError::new(
                ApiErrorCode::TooManyRequests,
                "too many sign up attempts",
            )),
        )
            .into_response();
    }

    let username = body.username.trim();
    if username.is_empty() || body.password.is_empty() {
        return invalid_credentials();
    }

    let user = match users::create(&state.pool, username, &body.password, UserRole::User).await {
        Ok(user) => user,
        Err(mc_db::DbError::Conflict(message)) => {
            return (
                StatusCode::CONFLICT,
                Json(ApiError::new(ApiErrorCode::Conflict, message)),
            )
                .into_response();
        }
        Err(_) => return invalid_credentials(),
    };

    issue_session(&state, &user).await
}

async fn change_password(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<ChangePasswordRequest>,
) -> Response {
    if body.new_password.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiError::new(
                ApiErrorCode::BadRequest,
                "new password cannot be empty",
            )),
        )
            .into_response();
    }

    let db_user = match users::get_by_id(&state.pool, user.id).await {
        Ok(user) => user,
        Err(_) => return invalid_credentials(),
    };

    if !users::verify_password(&body.current_password, &db_user.password_hash).unwrap_or(false) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiError::new(
                ApiErrorCode::Unauthorized,
                "current password is incorrect",
            )),
        )
            .into_response();
    }

    if let Err(err) = users::update_password(&state.pool, user.id, &body.new_password).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(ApiErrorCode::InternalError, err.to_string())),
        )
            .into_response();
    }

    StatusCode::NO_CONTENT.into_response()
}

async fn issue_session(state: &AppState, user: &mc_db::User) -> Response {
    let token = match state
        .auth
        .sessions
        .issue_token(user.id, &user.username, user.role)
    {
        Ok(token) => token,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(
                    ApiErrorCode::InternalError,
                    "failed to create session",
                )),
            )
                .into_response();
        }
    };

    let response = Json(LoginResponse {
        username: user.username.clone(),
        role: user.role.as_str().to_string(),
    });

    (
        StatusCode::OK,
        [(header::SET_COOKIE, state.auth.sessions.cookie_value(&token))],
        response,
    )
        .into_response()
}

fn sign_up_allowed(manager: &ServerManager) -> bool {
    manager.settings().cached_bool(SettingKey::SignUpEnabled)
        || manager.environment() == "development"
}

fn invalid_credentials() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(ApiError::new(
            ApiErrorCode::Unauthorized,
            "invalid username or password",
        )),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_error_is_generic() {
        let response = invalid_credentials();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }
}
