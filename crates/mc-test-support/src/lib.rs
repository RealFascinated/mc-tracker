//! Shared helpers for integration and crate-level tests.

use std::path::PathBuf;
use std::sync::Arc;

use mc_db::{DbPool, PoolSettings};
use mc_geo::GeoService;
use mc_settings::SettingsStore;
use mc_tracker::api::{router, AppState};
use mc_tracker::auth::{AuthContext, LoginRateLimiter, SessionManager};
use mc_tracker::chat::ChatRateLimiter;
use mc_tracker::insights::InsightsService;
use mc_tracker::manager::ServerManager;
use serde_json::json;
use testcontainers::runners::AsyncRunner;
use testcontainers::ImageExt;
use testcontainers_modules::postgres::Postgres;

mod mock_llm;

pub use mock_llm::{length_finish_chunk, text_chunk, MockLlmClient, MockLlmScript};
pub use testcontainers;
pub use testcontainers_modules;

pub type PostgresContainer =
    testcontainers::ContainerAsync<testcontainers_modules::postgres::Postgres>;

pub fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

pub fn api_fixture_path(name: &str) -> PathBuf {
    workspace_root().join("tests/fixtures/api").join(name)
}

pub fn load_api_fixture(name: &str) -> serde_json::Value {
    let path = api_fixture_path(name);
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|err| panic!("read fixture {}: {err}", path.display()));
    serde_json::from_str(&text)
        .unwrap_or_else(|err| panic!("parse fixture {}: {err}", path.display()))
}

pub async fn start_postgres() -> (PostgresContainer, String) {
    let postgres = Postgres::default()
        .with_tag("18-alpine")
        .start()
        .await
        .expect("start postgres container");
    let port = postgres.get_host_port_ipv4(5432).await.unwrap();
    let database_url = format!("postgres://postgres:postgres@127.0.0.1:{port}/postgres");
    (postgres, database_url)
}

pub async fn setup_pool(database_url: &str) -> DbPool {
    mc_db::setup_database(database_url, PoolSettings::default())
        .await
        .expect("setup database")
}

pub fn fixture_geo() -> Arc<GeoService> {
    let path = workspace_root().join("crates/mc-geo/tests/fixtures/GeoLite2-ASN-Test.mmdb");
    Arc::new(GeoService::from_database_file(path).unwrap())
}

pub async fn bootstrap_admin(pool: &DbPool) {
    mc_db::ensure_admin_user(
        pool,
        &mc_db::BootstrapConfig {
            admin_username: "admin".into(),
            admin_password: "adminpass".into(),
        },
    )
    .await
    .unwrap();
}

pub async fn settings_store(pool: &DbPool, deployment_environment: &str) -> Arc<SettingsStore> {
    Arc::new(
        SettingsStore::preload(pool.clone(), deployment_environment)
            .await
            .expect("preload settings"),
    )
}

pub async fn build_app(pool: DbPool, manager: Arc<ServerManager>) -> axum::Router {
    let deployment_environment = manager.environment().to_owned();
    build_app_with_env(pool, manager, &deployment_environment).await
}

pub async fn build_app_with_env(
    pool: DbPool,
    manager: Arc<ServerManager>,
    deployment_environment: &str,
) -> axum::Router {
    build_app_with_options(pool, manager, deployment_environment, None).await
}

pub async fn build_app_with_chat(
    pool: DbPool,
    manager: Arc<ServerManager>,
    deployment_environment: &str,
    chat: Arc<dyn mc_chat::ChatAgent>,
) -> axum::Router {
    build_app_with_options(pool, manager, deployment_environment, Some(chat)).await
}

async fn build_app_with_options(
    pool: DbPool,
    manager: Arc<ServerManager>,
    deployment_environment: &str,
    chat: Option<Arc<dyn mc_chat::ChatAgent>>,
) -> axum::Router {
    let sessions = Arc::new(SessionManager::new(b"test-secret", false));
    let settings = manager.settings();
    router(
        AppState {
            pool: pool.clone(),
            manager: Arc::clone(&manager),
            geo: fixture_geo(),
            auth: AuthContext {
                sessions,
                rate_limiter: LoginRateLimiter::new(),
            },
            insights: Arc::new(InsightsService::with_defaults(Arc::clone(&manager))),
            chat,
            chat_rate_limiter: Arc::new(ChatRateLimiter::new()),
        },
        &settings,
        deployment_environment,
    )
    .expect("valid CORS configuration in tests")
}

pub async fn manager_with_vm_url(pool: &DbPool, vm_base_url: &str) -> Arc<ServerManager> {
    manager_with_vm_url_env(pool, vm_base_url, "production").await
}

pub async fn manager_with_vm_url_env(
    pool: &DbPool,
    vm_base_url: &str,
    deployment_environment: &str,
) -> Arc<ServerManager> {
    let settings = settings_store(pool, deployment_environment).await;
    settings
        .update("victoriametrics_url", json!(vm_base_url))
        .await
        .unwrap();

    Arc::new(ServerManager::new(
        vec![],
        Some(pool.clone()),
        settings,
        fixture_geo(),
        None,
        deployment_environment,
    ))
}

pub async fn login_as(app: &axum::Router, username: &str, password: &str) -> String {
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    let body = serde_json::json!({ "username": username, "password": password });
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    response
        .headers()
        .get("set-cookie")
        .unwrap()
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string()
}

pub async fn login_admin(app: &axum::Router) -> String {
    login_as(app, "admin", "adminpass").await
}

pub async fn create_user(pool: &DbPool, username: &str, password: &str, role: mc_db::UserRole) {
    mc_db::db::repos::users::create(pool, username, password, role)
        .await
        .unwrap();
}

pub async fn manager_from_pool(pool: &DbPool, deployment_environment: &str) -> Arc<ServerManager> {
    let settings = settings_store(pool, deployment_environment).await;
    Arc::new(ServerManager::new(
        vec![],
        None,
        settings,
        fixture_geo(),
        None,
        deployment_environment,
    ))
}

pub async fn enable_sign_up(pool: &DbPool, manager: &Arc<ServerManager>) {
    mc_db::db::repos::settings::set(pool, "sign_up_enabled", "true")
        .await
        .unwrap();
    manager
        .settings()
        .update("sign_up_enabled", json!(true))
        .await
        .unwrap();
}
