mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use mc_tracker::manager::ServerManager;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower::ServiceExt;

#[tokio::test]
async fn metrics_endpoint_returns_not_found() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let settings = Arc::new(RwLock::new(
        mc_db::db::repos::settings::load_all(&pool).await.unwrap(),
    ));
    let bootstrap = settings.read().await.clone();
    let manager = Arc::new(ServerManager::new(
        vec![],
        None,
        settings,
        common::fixture_geo(),
        None,
        &bootstrap,
        "development",
    ));
    let app = common::build_app(pool, manager).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/metrics")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(body["error"], "not found");
}
