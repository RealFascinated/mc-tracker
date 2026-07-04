use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::{header, Method, StatusCode};
use axum::middleware;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use mc_api_types::{
    ApiError, ApiErrorCode, AsnDetailQuery, AsnTimeseriesQuery, AsnTimeseriesSummaryQuery,
    AsnsListQuery, AsnsListResponse, HealthResponse, ServersCompareQuery, ServersListQuery,
    ServersListResponse, ServersSearchQuery, ServersSearchResponse, TimeseriesQuery,
    TimeseriesSummaryQuery,
};
use mc_db::AppSettings;
use mc_db::DbPool;
use mc_geo::GeoService;
use mc_common::constants::limits::MAX_COMPARE_SERVERS;
use tower_http::cors::{AllowOrigin, CorsLayer};
use uuid::Uuid;

use crate::admin;
use crate::auth::{require_admin, AuthContext};
use crate::chat::ChatRateLimiter;
use crate::insights::{map_insights_error, resolve_compare_max_points, InsightsService};
use crate::manager::ServerManager;

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
    pub manager: Arc<ServerManager>,
    pub geo: Arc<GeoService>,
    pub auth: AuthContext,
    pub insights: Arc<InsightsService>,
    pub chat: Option<Arc<dyn mc_chat::ChatAgent>>,
    pub chat_rate_limiter: Arc<ChatRateLimiter>,
}

pub fn cors_layer(
    settings: &AppSettings,
    deployment_environment: &str,
) -> Result<CorsLayer, String> {
    let allow_same_origin_only = cfg!(feature = "embedded-ui");
    let origins: Result<Vec<_>, _> = settings
        .cors_origin_candidates(deployment_environment, allow_same_origin_only)?
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
    settings: &AppSettings,
    deployment_environment: &str,
) -> Result<Router, String> {
    let cors = cors_layer(settings, deployment_environment)?;

    let mut app = Router::new()
        .route("/health", get(health))
        .route("/servers", get(list_servers))
        .route("/servers/search", get(search_servers))
        .route("/servers/compare/summary", get(servers_compare_summary))
        .route("/servers/timeseries/total", get(total_timeseries))
        .route("/servers/{id}", get(get_server))
        .route("/servers/{id}/timeseries", get(server_timeseries))
        .route(
            "/servers/{id}/timeseries/summary",
            get(server_timeseries_summary),
        )
        .route(
            "/servers/timeseries/total/summary",
            get(total_timeseries_summary),
        )
        .route("/asns", get(list_asns))
        .route("/asns/timeseries", get(asn_timeseries))
        .route("/asns/timeseries/summary", get(asn_timeseries_summary))
        .route("/asns/{asn}", get(get_asn))
        .merge(crate::chat::router())
        .merge(crate::pinned_servers::router())
        .nest("/auth", crate::auth::router())
        .nest(
            "/admin",
            admin::router()
                .route_layer(middleware::from_fn_with_state(state.clone(), require_admin)),
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
    match state
        .manager
        .asn_timeseries(
            &query.asn,
            query.asn_org.as_deref().unwrap_or_default(),
            query.from,
            query.to,
        )
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => map_metrics_error(err),
    }
}

async fn total_timeseries(
    State(state): State<AppState>,
    Query(query): Query<TimeseriesQuery>,
) -> Response {
    match state.manager.total_timeseries(query.from, query.to).await {
        Ok(response) => Json(response).into_response(),
        Err(err) => map_metrics_error(err),
    }
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

async fn server_timeseries_summary(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<TimeseriesSummaryQuery>,
) -> Response {
    match state
        .insights
        .server_timeseries_summary(id, &query.from, &query.to)
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => {
            let (status, error) = map_insights_error(err);
            (status, Json(error)).into_response()
        }
    }
}

async fn total_timeseries_summary(
    State(state): State<AppState>,
    Query(query): Query<TimeseriesSummaryQuery>,
) -> Response {
    match state
        .insights
        .total_timeseries_summary(&query.from, &query.to)
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => {
            let (status, error) = map_insights_error(err);
            (status, Json(error)).into_response()
        }
    }
}

async fn asn_timeseries_summary(
    State(state): State<AppState>,
    Query(query): Query<AsnTimeseriesSummaryQuery>,
) -> Response {
    match state
        .insights
        .asn_timeseries_summary(
            &query.asn,
            query.asn_org.as_deref().unwrap_or_default(),
            &query.from,
            &query.to,
        )
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => {
            let (status, error) = map_insights_error(err);
            (status, Json(error)).into_response()
        }
    }
}

async fn servers_compare_summary(
    State(state): State<AppState>,
    Query(query): Query<ServersCompareQuery>,
) -> Response {
    let ids = match parse_compare_ids(&query.ids) {
        Ok(ids) => ids,
        Err(error) => return (StatusCode::BAD_REQUEST, Json(error)).into_response(),
    };
    let max_points = match resolve_compare_max_points(query.max_points) {
        Ok(max_points) => max_points,
        Err(err) => {
            let (status, error) = map_insights_error(err);
            return (status, Json(error)).into_response();
        }
    };
    match state
        .insights
        .compare_servers(&ids, &query.from, &query.to, max_points)
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => {
            let (status, error) = map_insights_error(err);
            (status, Json(error)).into_response()
        }
    }
}

fn parse_compare_ids(ids: &str) -> Result<Vec<Uuid>, ApiError> {
    let ids: Result<Vec<Uuid>, _> = ids
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(Uuid::parse_str)
        .collect();
    let ids = ids.map_err(|_| {
        ApiError::new(ApiErrorCode::BadRequest, "invalid server id in ids")
    })?;
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

fn map_metrics_error(err: mc_metrics::MetricsError) -> Response {
    let (status, code, message) = match &err {
        mc_metrics::MetricsError::InvalidWindow(message) => (
            StatusCode::BAD_REQUEST,
            ApiErrorCode::InvalidRange,
            message.clone(),
        ),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            ApiErrorCode::InternalError,
            err.to_string(),
        ),
    };
    (status, Json(ApiError::new(code, message))).into_response()
}
