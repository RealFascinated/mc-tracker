use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::{header, Method, StatusCode};
use axum::middleware;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use mc_api_types::{ErrorResponse, HealthResponse, ServersListResponse};
use mc_db::AppSettings;
use mc_db::DbPool;
use mc_geo::GeoService;
use serde::Deserialize;
use tower_http::cors::{AllowOrigin, CorsLayer};
use uuid::Uuid;

use crate::admin;
use crate::auth::{require_admin, AuthContext};
use crate::manager::ServerManager;

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
    pub manager: Arc<ServerManager>,
    pub geo: Arc<GeoService>,
    pub auth: AuthContext,
}

pub fn cors_layer(settings: &AppSettings, deployment_environment: &str) -> Result<CorsLayer, String> {
    let origins: Result<Vec<_>, _> = settings
        .cors_origin_candidates(deployment_environment)?
        .into_iter()
        .map(|origin| origin.parse())
        .collect();
    let origins = origins.map_err(|_| "invalid CORS origin".to_string())?;

    Ok(CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::ACCEPT,
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::COOKIE,
        ]))
}

pub fn router(
    state: AppState,
    settings: &AppSettings,
    deployment_environment: &str,
) -> Result<Router, String> {
    let cors = cors_layer(settings, deployment_environment)?;

    Ok(Router::new()
        .route("/health", get(health))
        .route("/servers", get(list_servers))
        .route("/servers/{id}/timeseries", get(server_timeseries))
        .nest("/auth", crate::auth::router())
        .nest(
            "/admin",
            admin::router().route_layer(middleware::from_fn_with_state(
                state.clone(),
                require_admin,
            )),
        )
        .fallback(not_found)
        .layer(cors)
        .with_state(state))
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_ok = mc_db::health_check(&state.pool).await;
    let maxmind_ok = state.geo.is_ready();
    Json(HealthResponse::ok(db_ok, maxmind_ok))
}

async fn list_servers(State(state): State<AppState>) -> Json<ServersListResponse> {
    Json(state.manager.servers_list_response().await)
}

#[derive(Debug, Deserialize)]
struct TimeseriesQuery {
    from: i64,
    to: i64,
}

async fn server_timeseries(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TimeseriesQuery>,
) -> Response {
    match state
        .manager
        .server_timeseries(id, query.from, query.to)
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => map_metrics_error(err),
    }
}

async fn not_found() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(ErrorResponse::new("not found")),
    )
}

fn map_metrics_error(err: mc_metrics::MetricsError) -> Response {
    let (status, message) = match &err {
        mc_metrics::MetricsError::InvalidWindow(message) => {
            (StatusCode::BAD_REQUEST, message.clone())
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    };
    (status, Json(ErrorResponse::new(message))).into_response()
}
