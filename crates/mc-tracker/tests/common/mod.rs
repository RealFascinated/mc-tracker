use mc_db::{DbPool, PoolSettings};
use mc_geo::GeoService;
use mc_tracker::auth::{AuthContext, LoginRateLimiter, SessionManager};
use mc_tracker::api::{router, AppState};
use mc_tracker::manager::ServerManager;
use std::sync::Arc;
use testcontainers::ImageExt;
use testcontainers::runners::AsyncRunner;
use testcontainers_modules::postgres::Postgres;

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
    let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../mc-geo/tests/fixtures/GeoLite2-ASN-Test.mmdb");
    Arc::new(GeoService::from_database_file(path).unwrap())
}

pub async fn build_app(
    pool: DbPool,
    manager: Arc<ServerManager>,
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
        manager.environment(),
    )
    .expect("valid CORS configuration in tests")
}

#[allow(dead_code)]
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

#[allow(dead_code)]
pub async fn create_user(pool: &DbPool, username: &str, password: &str, role: mc_db::UserRole) {
    mc_db::db::repos::users::create(pool, username, password, role)
        .await
        .unwrap();
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
