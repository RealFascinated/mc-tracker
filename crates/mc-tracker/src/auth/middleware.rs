use axum::extract::{FromRequestParts, Request, State};
use axum::http::request::Parts;
use axum::http::{header, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use mc_api_types::{ApiError, ApiErrorCode};
use mc_db::db::repos::users;
use mc_db::model::{can_manage_servers, UserFlags, UserRole};
use uuid::Uuid;

use super::session::COOKIE_NAME;
use crate::api::AppState;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub username: String,
    pub role: UserRole,
    pub flags: UserFlags,
    pub token: String,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        authenticate_request(parts, state).await
    }
}

pub async fn require_admin(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let (parts, body) = request.into_parts();
    let user = match authenticate_request(&parts, &state).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if user.role != UserRole::Admin {
        return forbidden();
    }
    let mut request = Request::from_parts(parts, body);
    request.extensions_mut().insert(user);
    next.run(request).await
}

pub(crate) async fn authenticate_request(
    parts: &Parts,
    state: &AppState,
) -> Result<AuthUser, Response> {
    let token = session_token_from_parts(parts).ok_or_else(unauthorized)?;
    let claims = state
        .auth
        .sessions
        .validate_token(&token)
        .await
        .map_err(|_| unauthorized())?;
    let user = users::get_by_id(&state.pool, claims.sub)
        .await
        .map_err(|_| unauthorized())?;
    Ok(AuthUser {
        id: user.id,
        username: user.username,
        role: user.role,
        flags: user.flags,
        token,
    })
}

pub fn session_token_from_parts(parts: &Parts) -> Option<String> {
    let cookie_header = parts
        .headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok())?;
    parse_cookie_value(cookie_header, COOKIE_NAME)
}

pub fn parse_cookie_value(cookie_header: &str, name: &str) -> Option<String> {
    for part in cookie_header.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix(&format!("{name}=")) {
            return Some(value.to_string());
        }
    }
    None
}

fn unauthorized() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(ApiError::new(ApiErrorCode::Unauthorized, "unauthorized")),
    )
        .into_response()
}

fn forbidden() -> Response {
    (
        StatusCode::FORBIDDEN,
        Json(ApiError::new(ApiErrorCode::Forbidden, "forbidden")),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_session_cookie() {
        let value = parse_cookie_value("foo=bar; mc_tracker_session=abc.def; baz=1", COOKIE_NAME);
        assert_eq!(value.as_deref(), Some("abc.def"));
    }
}
