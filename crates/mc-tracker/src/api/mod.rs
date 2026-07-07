use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::{header, Method, StatusCode};
use axum::middleware;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use mc_api_types::{
    ApiError, ApiErrorCode, AsnDetailQuery, AsnTimeseriesQuery, AsnsListQuery, AsnsListResponse,
    ErrorTarget, HealthResponse, PartialError, ServersCompareQuery, ServersListQuery,
    ServersListResponse, ServersSearchQuery, ServersSearchResponse, SettingsListResponse,
    TimeseriesQuery,
};
use mc_common::constants::limits::MAX_COMPARE_SERVERS;
use mc_db::DbPool;
use mc_geo::GeoService;
use mc_insights::{Insights, InsightsError};
use mc_settings::{cors_origin_candidates, SettingsStore};
use tower_http::cors::{AllowOrigin, CorsLayer};
use uuid::Uuid;

use crate::admin;
use crate::auth::{require_admin, require_manage_servers, AuthContext};
use crate::chat::ChatRateLimiter;
use crate::manager::ServerManager;
use crate::settings_api::to_settings_list;

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
    pub manager: Arc<ServerManager>,
    pub insights: Arc<Insights>,
    pub geo: Arc<GeoService>,
    pub auth: AuthContext,
    pub chat: Option<Arc<dyn mc_chat::ChatAgent>>,
    pub chat_rate_limiter: Arc<ChatRateLimiter>,
}

pub fn cors_layer(
    settings: &SettingsStore,
    deployment_environment: &str,
) -> Result<CorsLayer, String> {
    let allow_same_origin_only = cfg!(feature = "embedded-ui");
    let www_origin = settings.cached_str(mc_settings::SettingKey::WwwOrigin);
    let origins: Result<Vec<_>, _> =
        cors_origin_candidates(&www_origin, deployment_environment, allow_same_origin_only)?
            .into_iter()
            .map(|origin| origin.parse())
            .collect();
    let origins = origins.map_err(|_| "invalid CORS origin".to_string())?;

    if origins.is_empty() {
        return Ok(CorsLayer::new());
    }

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
    settings: &SettingsStore,
    deployment_environment: &str,
) -> Result<Router, String> {
    let cors = cors_layer(settings, deployment_environment)?;

    let mut app = Router::new()
        .route("/health", get(health))
        .route("/settings/public", get(public_settings))
        .route("/servers", get(list_servers))
        .route("/servers/search", get(search_servers))
        .route(
            "/servers/compare/timeseries",
            get(servers_compare_timeseries),
        )
        .route("/servers/timeseries/total", get(total_timeseries))
        .route("/servers/{id}", get(get_server))
        .route("/servers/{id}/timeseries", get(server_timeseries))
        .route("/asns", get(list_asns))
        .route("/asns/timeseries", get(asn_timeseries))
        .route("/asns/{asn}", get(get_asn))
        .merge(crate::chat::router())
        .merge(crate::pinned_servers::router())
        .nest("/auth", crate::auth::router())
        .nest(
            "/admin/servers",
            admin::servers_router().route_layer(middleware::from_fn_with_state(
                state.clone(),
                require_manage_servers,
            )),
        )
        .nest(
            "/admin",
            admin::restricted_router().route_layer(middleware::from_fn_with_state(
                state.clone(),
                require_admin,
            )),
        );

    #[cfg(feature = "embedded-ui")]
    {
        app = app
            .route("/", get(crate::embedded::root_redirect))
            .route("/ui", get(crate::embedded::ui_handler))
            .route("/ui/", get(crate::embedded::ui_handler))
            .route("/ui/{*path}", get(crate::embedded::ui_handler));
    }

    Ok(app.fallback(not_found).layer(cors).with_state(state))
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_ok = mc_db::health_check(&state.pool).await;
    let maxmind_ok = state.geo.is_ready();
    Json(HealthResponse::ok(db_ok, maxmind_ok))
}

async fn public_settings(State(state): State<AppState>) -> Json<SettingsListResponse> {
    let items = state.manager.settings().list_public().await;
    Json(to_settings_list(items))
}

fn trim_search(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|query| !query.is_empty())
}

async fn list_servers(
    State(state): State<AppState>,
    Query(query): Query<ServersListQuery>,
) -> Json<ServersListResponse> {
    Json(
        state
            .manager
            .servers_list_response(
                trim_search(query.search.as_deref()),
                query.sort,
                query.order,
            )
            .await,
    )
}

async fn get_server(State(state): State<AppState>, Path(id): Path<Uuid>) -> Response {
    match state.manager.server_detail_response(id).await {
        Some(response) => Json(response).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(ApiError::new(
                ApiErrorCode::ServerNotFound,
                "server not found",
            )),
        )
            .into_response(),
    }
}

async fn search_servers(
    State(state): State<AppState>,
    Query(query): Query<ServersSearchQuery>,
) -> Json<ServersSearchResponse> {
    Json(
        state
            .manager
            .servers_search_response(trim_search(query.search.as_deref()), query.limit)
            .await,
    )
}

async fn list_asns(
    State(state): State<AppState>,
    Query(query): Query<AsnsListQuery>,
) -> Json<AsnsListResponse> {
    Json(
        state
            .manager
            .asns_list_response(trim_search(query.search.as_deref()))
            .await,
    )
}

async fn get_asn(
    State(state): State<AppState>,
    Path(asn): Path<String>,
    Query(query): Query<AsnDetailQuery>,
) -> Response {
    let asn_org = query.asn_org.as_deref().unwrap_or_default();
    match state.manager.asn_detail_response(&asn, asn_org).await {
        Some(response) => Json(response).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(ApiError::new(ApiErrorCode::AsnNotFound, "asn not found")),
        )
            .into_response(),
    }
}

async fn asn_timeseries(
    State(state): State<AppState>,
    Query(query): Query<AsnTimeseriesQuery>,
) -> Response {
    let asn_org = query.asn_org.as_deref().unwrap_or_default();
    match state
        .insights
        .asn_players_lanes(state.manager.as_ref(), &query.asn, asn_org, query.from, query.to)
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => map_insights_error(err),
    }
}

async fn total_timeseries(
    State(state): State<AppState>,
    Query(query): Query<TimeseriesQuery>,
) -> Response {
    match state
        .insights
        .total_players_lanes(state.manager.as_ref(), query.from, query.to)
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => map_insights_error(err),
    }
}

async fn server_timeseries(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TimeseriesQuery>,
) -> Response {
    match state
        .insights
        .server_players_lanes(state.manager.as_ref(), id, query.from, query.to)
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => map_insights_error(err),
    }
}

async fn servers_compare_timeseries(
    State(state): State<AppState>,
    Query(query): Query<ServersCompareQuery>,
) -> Response {
    let ids = match parse_compare_ids(&query.ids) {
        Ok(ids) => ids,
        Err(error) => return (StatusCode::BAD_REQUEST, Json(error)).into_response(),
    };

    match state
        .insights
        .compare_servers_lanes(state.manager.as_ref(), &ids, query.from, query.to)
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => map_insights_error(err),
    }
}

fn map_insights_error(err: InsightsError) -> Response {
    let (status, code, message) = match &err {
        InsightsError::InvalidRange(message) => (
            StatusCode::BAD_REQUEST,
            ApiErrorCode::InvalidRange,
            message.clone(),
        ),
        InsightsError::NoData => (
            StatusCode::NOT_FOUND,
            ApiErrorCode::NotFound,
            "no data in range".into(),
        ),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            ApiErrorCode::InternalError,
            err.to_string(),
        ),
    };
    (
        status,
        Json(ApiError::new(code, message)),
    )
        .into_response()
}

#[allow(dead_code)]
fn map_insights_partial_error(id: Uuid, err: InsightsError) -> PartialError {
    let (code, message) = match &err {
        InsightsError::InvalidRange(message) => (ApiErrorCode::InvalidRange, message.clone()),
        _ => (ApiErrorCode::InternalError, err.to_string()),
    };
    PartialError::new(code, message, ErrorTarget::Server { id: id.to_string() })
}

pub fn parse_compare_ids(ids: &str) -> Result<Vec<Uuid>, ApiError> {
    let ids: Result<Vec<Uuid>, _> = ids
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(Uuid::parse_str)
        .collect();
    let ids =
        ids.map_err(|_| ApiError::new(ApiErrorCode::BadRequest, "invalid server id in ids"))?;
    if ids.len() < 2 || ids.len() > MAX_COMPARE_SERVERS {
        return Err(ApiError::new(
            ApiErrorCode::BadRequest,
            format!("need between 2 and {MAX_COMPARE_SERVERS} server ids"),
        ));
    }
    Ok(ids)
}

async fn not_found() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(ApiError::new(ApiErrorCode::NotFound, "not found")),
    )
}
