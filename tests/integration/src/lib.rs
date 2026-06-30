//! Shared helpers for workspace-level integration tests.

use std::path::PathBuf;
use std::sync::Arc;

use mc_db::{DbPool, PoolSettings};
use mc_geo::GeoService;
use mc_tracker::api::{router, AppState};
use mc_tracker::auth::{AuthContext, LoginRateLimiter, SessionManager};
use mc_tracker::manager::ServerManager;
use testcontainers::runners::AsyncRunner;
use testcontainers::ImageExt;
use testcontainers_modules::postgres::Postgres;
use tokio::sync::RwLock;

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

pub async fn start_postgres() -> (testcontainers::ContainerAsync<Postgres>, String) {
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

pub async fn build_app(
    pool: DbPool,
    manager: Arc<ServerManager>,
    deployment_environment: &str,
) -> axum::Router {
    let sessions = Arc::new(SessionManager::new(b"test-secret", false));
    let settings = manager.settings().await;
    router(
        AppState {
            pool: pool.clone(),
            manager: Arc::clone(&manager),
            geo: fixture_geo(),
            auth: AuthContext {
                sessions,
                rate_limiter: LoginRateLimiter::new(),
            },
        },
        &settings,
        deployment_environment,
    )
    .expect("valid CORS configuration in tests")
}

pub async fn manager_with_vm_url(pool: &DbPool, vm_base_url: &str) -> Arc<ServerManager> {
    let settings = Arc::new(RwLock::new(
        mc_db::db::repos::settings::load_all(pool).await.unwrap(),
    ));
    {
        let mut current = settings.write().await;
        current.victoriametrics_url = vm_base_url.into();
    }
    mc_db::db::repos::settings::set(pool, "victoriametrics_url", vm_base_url)
        .await
        .unwrap();

    let bootstrap = settings.read().await.clone();
    Arc::new(ServerManager::new(
        vec![],
        settings,
        fixture_geo(),
        None,
        &bootstrap,
        "production",
    ))
}
