mod common;

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use mc_tracker::manager::ServerManager;
use tokio::sync::RwLock;
use tower::ServiceExt;

#[tokio::test]
async fn get_and_patch_admin_settings() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let settings = Arc::new(RwLock::new(
        mc_db::db::repos::settings::load_all(&pool).await.unwrap(),
    ));
    let bootstrap = settings.read().await.clone();
    let manager = Arc::new(ServerManager::new(
        vec![],
        Arc::clone(&settings),
        common::fixture_geo(),
        None,
        &bootstrap,
        "development",
    ));

    let app = common::build_app(pool.clone(), Arc::clone(&manager)).await;
    let cookie = common::login_admin(&app).await;

    let get = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/admin/settings")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get.status(), StatusCode::OK);
    let current: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(get.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(current["metricsPushIntervalSeconds"], 10);

    let patch = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/admin/settings")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"metricsPushIntervalSeconds":45,"victoriametricsUrl":"http://vm:8428"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(patch.status(), StatusCode::OK);
    let updated: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(patch.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(updated["metricsPushIntervalSeconds"], 45);
    assert_eq!(updated["victoriametricsUrl"], "http://vm:8428");

    let in_memory = manager.settings().await;
    assert_eq!(in_memory.metrics_push_interval_seconds, 45);
    assert_eq!(in_memory.victoriametrics_url, "http://vm:8428");

    let from_db = mc_db::db::repos::settings::load_all(&pool).await.unwrap();
    assert_eq!(from_db.metrics_push_interval_seconds, 45);
    assert_eq!(from_db.victoriametrics_url, "http://vm:8428");
}

#[tokio::test]
async fn patch_admin_settings_rejects_invalid_values() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let settings = Arc::new(RwLock::new(
        mc_db::db::repos::settings::load_all(&pool).await.unwrap(),
    ));
    let bootstrap = settings.read().await.clone();
    let manager = Arc::new(ServerManager::new(
        vec![],
        Arc::clone(&settings),
        common::fixture_geo(),
        None,
        &bootstrap,
        "development",
    ));

    let app = common::build_app(pool, Arc::clone(&manager)).await;
    let cookie = common::login_admin(&app).await;

    let patch = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/admin/settings")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"metricsPushIntervalSeconds":0}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(patch.status(), StatusCode::BAD_REQUEST);
}
